from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
import models
import os
import tempfile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

from security import require_organization 

router = APIRouter(prefix="/documents", tags=["Documents"])
embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_organization), 
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        pages = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(pages)
        
        db_chunks = []
        for chunk in chunks:
            vector = embeddings_model.embed_query(chunk.page_content)
            
            db_chunk = models.DocumentChunk(
                org_id=current_user.org_id, 
                filename=file.filename,
                content=chunk.page_content,
                embedding=vector
            )
            db.add(db_chunk)
            db_chunks.append(db_chunk)
            
        await db.commit()
        return {"message": f"Successfully ingested {file.filename}", "chunks_created": len(db_chunks)}
        
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.get("")
async def list_documents(
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    # Return grouped documents by filename for the organization
    from sqlalchemy import select, func

    stmt = select(models.DocumentChunk.filename, func.count(models.DocumentChunk.id).label('chunks'), func.max(models.DocumentChunk.created_at).label('latest')).where(models.DocumentChunk.org_id == current_user.org_id).group_by(models.DocumentChunk.filename)
    result = await db.execute(stmt)
    rows = result.all()
    docs = []
    for filename, chunks, latest in rows:
        docs.append({
            'filename': filename,
            'chunks': chunks,
            'latest_created_at': latest.isoformat() if latest else None
        })
    return docs


@router.delete("")
async def delete_document(
    filename: str,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    # Delete all chunks for a filename in the organization
    from sqlalchemy import delete

    if not filename:
        raise HTTPException(status_code=400, detail="filename query parameter required")

    stmt = delete(models.DocumentChunk).where(models.DocumentChunk.org_id == current_user.org_id, models.DocumentChunk.filename == filename)
    await db.execute(stmt)
    await db.commit()
    return {"message": f"Deleted document {filename}"}
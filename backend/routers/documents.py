from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
import models

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
import os
import tempfile

router = APIRouter(prefix="/documents", tags=["Documents"])

embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

@router.post("/upload")
async def upload_document(
    org_id: str = Form(...),
    file: UploadFile = File(...),
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
                org_id=org_id,
                filename=file.filename,
                content=chunk.page_content,
                embedding=vector
            )
            db.add(db_chunk)
            db_chunks.append(db_chunk)
            
        await db.commit()
        
        return {
            "message": f"Successfully ingested {file.filename}",
            "chunks_created": len(db_chunks)
        }
        
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
#!/usr/bin/env python3
"""
Manage document search indexes for performance optimization.

This script provides utilities to:
1. Create/recreate IVFFlat indexes for fast vector similarity search
2. Analyze index quality
3. Rebuild indexes after bulk document uploads
4. Check index statistics
"""

import asyncio
import argparse
from sqlalchemy import text
from database import engine

IVFFLAT_INDEX_NAME = "idx_document_chunks_embedding"
IVFFLAT_INDEX_QUERY = f"""
    CREATE INDEX IF NOT EXISTS {IVFFLAT_INDEX_NAME}
    ON document_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
"""

REBUILD_INDEX_QUERY = f"""
    REINDEX INDEX CONCURRENTLY {IVFFLAT_INDEX_NAME}
"""

ANALYZE_INDEX_QUERY = """
    ANALYZE document_chunks
"""

INDEX_STATS_QUERY = f"""
    SELECT
        indexname,
        tablename,
        indexdef
    FROM pg_indexes
    WHERE indexname = '{IVFFLAT_INDEX_NAME}'
"""

DOCUMENT_COUNT_QUERY = """
    SELECT COUNT(*) as total_chunks FROM document_chunks
"""


async def create_index():
    """Create IVFFlat index for vector similarity search."""
    async with engine.begin() as conn:
        print("Creating IVFFlat index on document_chunks.embedding...")
        try:
            await conn.execute(text(IVFFLAT_INDEX_QUERY))
            print("✓ IVFFlat index created successfully")
            await conn.execute(text(ANALYZE_INDEX_QUERY))
            print("✓ Index analyzed")
        except Exception as e:
            print(f"✗ Error creating index: {e}")
            return False
    return True


async def rebuild_index():
    """Rebuild existing IVFFlat index (useful after bulk uploads)."""
    async with engine.begin() as conn:
        print("Rebuilding IVFFlat index...")
        try:
            await conn.execute(text(REBUILD_INDEX_QUERY))
            print("✓ Index rebuilt successfully")
            await conn.execute(text(ANALYZE_INDEX_QUERY))
            print("✓ Index analyzed")
        except Exception as e:
            print(f"✗ Error rebuilding index: {e}")
            return False
    return True


async def show_stats():
    """Display index statistics and document count."""
    async with engine.begin() as conn:
        try:
            # Get index stats
            result = await conn.execute(text(INDEX_STATS_QUERY))
            rows = result.fetchall()
            
            if rows:
                print("\nIndex Information:")
                print("=" * 70)
                for row in rows:
                    print(f"Index Name: {row[0]}")
                    print(f"Table Name: {row[1]}")
                    print(f"Definition:\n  {row[2]}")
            else:
                print("✗ Index not found. Run 'create' command to create it.")
                return False
            
            # Get document count
            count_result = await conn.execute(text(DOCUMENT_COUNT_QUERY))
            count_row = count_result.fetchone()
            total_chunks = count_row[0] if count_row else 0
            
            print(f"\nDocument Statistics:")
            print("=" * 70)
            print(f"Total Document Chunks: {total_chunks:,}")
            
            if total_chunks > 0:
                print(f"Estimated Query Speed-up: 10-100x faster than full scan")
                print(f"Recommended Rebuild Frequency: After every 1000+ new documents")
            
        except Exception as e:
            print(f"✗ Error fetching statistics: {e}")
            return False
    return True


async def main():
    parser = argparse.ArgumentParser(
        description="Manage document search indexes for performance",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python manage_search_index.py create   # Create IVFFlat index
  python manage_search_index.py rebuild  # Rebuild index after bulk uploads
  python manage_search_index.py stats    # Show index and document statistics
        """
    )
    
    parser.add_argument(
        "action",
        choices=["create", "rebuild", "stats"],
        help="Action to perform"
    )
    
    args = parser.parse_args()
    
    if args.action == "create":
        success = await create_index()
    elif args.action == "rebuild":
        success = await rebuild_index()
    elif args.action == "stats":
        success = await show_stats()
    
    exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())

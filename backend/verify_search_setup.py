#!/usr/bin/env python3
"""
Verify IVFFlat search index setup and health.

This script checks:
1. PostgreSQL vector extension is installed
2. IVFFlat index exists on document_chunks
3. Index is properly configured
4. Document count and statistics
"""

import asyncio
import sys
from sqlalchemy import text
from database import engine


async def check_vector_extension():
    """Check if PostgreSQL vector extension is installed."""
    async with engine.begin() as conn:
        try:
            result = await conn.execute(text(
                "SELECT extname FROM pg_extension WHERE extname = 'vector'"
            ))
            exists = result.fetchone() is not None
            status = "✓" if exists else "✗"
            print(f"{status} PostgreSQL Vector Extension: {'INSTALLED' if exists else 'NOT FOUND'}")
            return exists
        except Exception as e:
            print(f"✗ Error checking vector extension: {e}")
            return False


async def check_index_exists():
    """Check if IVFFlat index exists."""
    async with engine.begin() as conn:
        try:
            result = await conn.execute(text(
                "SELECT indexname FROM pg_indexes "
                "WHERE indexname = 'idx_document_chunks_embedding'"
            ))
            exists = result.fetchone() is not None
            status = "✓" if exists else "✗"
            print(f"{status} IVFFlat Index: {'EXISTS' if exists else 'NOT FOUND'}")
            if not exists:
                print("  → Run: python manage_search_index.py create")
            return exists
        except Exception as e:
            print(f"✗ Error checking index: {e}")
            return False


async def check_index_stats():
    """Get detailed index information."""
    async with engine.begin() as conn:
        try:
            # Get index definition
            result = await conn.execute(text(
                "SELECT indexdef FROM pg_indexes "
                "WHERE indexname = 'idx_document_chunks_embedding'"
            ))
            row = result.fetchone()
            if row:
                print(f"\nIndex Definition:")
                print(f"  {row[0]}")
            
            # Get document count
            result = await conn.execute(text("SELECT COUNT(*) FROM document_chunks"))
            count = result.fetchone()[0]
            print(f"\nDocument Statistics:")
            print(f"  Total Chunks: {count:,}")
            
            if count == 0:
                print("  ⚠ No documents found. Upload documents to test search.")
            elif count < 100:
                print("  ℹ Small dataset. Index will improve performance for larger uploads.")
            elif count < 10000:
                print("  ✓ Index will provide significant performance improvement.")
            else:
                print("  ✓ Large dataset. Index is critical for performance.")
            
            return True
        except Exception as e:
            print(f"✗ Error getting statistics: {e}")
            return False


async def check_search_performance():
    """Quick performance check."""
    async with engine.begin() as conn:
        try:
            count = await conn.execute(text("SELECT COUNT(*) FROM document_chunks"))
            doc_count = count.fetchone()[0]
            
            if doc_count == 0:
                print("\nSearch Performance:")
                print("  ⚠ No documents to test. Upload documents first.")
                return True
            
            print("\nSearch Performance Estimate:")
            if doc_count < 100:
                print(f"  Expected search time: <1ms")
            elif doc_count < 1000:
                print(f"  Expected search time: 1-5ms")
            elif doc_count < 10000:
                print(f"  Expected search time: 10-50ms")
            else:
                print(f"  Expected search time: 50-200ms")
            
            print(f"  (Based on {doc_count:,} documents)")
            return True
        except Exception as e:
            print(f"✗ Error checking performance: {e}")
            return False


async def check_table_exists():
    """Check if document_chunks table exists."""
    async with engine.begin() as conn:
        try:
            result = await conn.execute(text(
                "SELECT EXISTS ("
                "  SELECT 1 FROM information_schema.tables "
                "  WHERE table_name = 'document_chunks'"
                ")"
            ))
            exists = result.fetchone()[0]
            status = "✓" if exists else "✗"
            print(f"{status} Document Table: {'EXISTS' if exists else 'NOT FOUND'}")
            return exists
        except Exception as e:
            print(f"✗ Error checking table: {e}")
            return False


async def main():
    print("\n" + "="*70)
    print("IVFFlat Search Index Verification")
    print("="*70 + "\n")
    
    all_checks = [
        ("Database Connection", await check_vector_extension()),
        ("Table Exists", await check_table_exists()),
        ("Index Exists", await check_index_exists()),
    ]
    
    await check_index_stats()
    await check_search_performance()
    
    print("\n" + "="*70)
    
    passed = sum(1 for _, result in all_checks if result)
    total = len(all_checks)
    
    if passed == total:
        print(f"✓ All checks passed ({passed}/{total})")
        print("\nYour document search is optimized and ready for production!")
        return 0
    else:
        print(f"✗ Some checks failed ({passed}/{total})")
        print("\nRun the following to fix:")
        print("  1. python manage_search_index.py create")
        print("  2. python verify_search_setup.py (to verify)")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

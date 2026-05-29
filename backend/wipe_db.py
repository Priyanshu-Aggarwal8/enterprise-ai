import asyncio
from database import engine, Base
import models # IMPORTANT: We must import models so SQLAlchemy knows which tables exist!

async def reset_database():
    print("⚠️ WARNING: Initiating complete database factory reset...")
    
    async with engine.begin() as conn:
        print("Dropping all tables...")
        # run_sync safely bridges our async engine with SQLAlchemy's synchronous metadata
        await conn.run_sync(Base.metadata.drop_all)
        
        print("Recreating clean tables...")
        # Instantly rebuilds the tables exactly as they are defined in your models.py
        await conn.run_sync(Base.metadata.create_all)
        
    print("✅ SUCCESS: The database has been completely wiped and reset to a blank slate.")

if __name__ == "__main__":
    confirm = input("🔥 Are you ABSOLUTELY SURE you want to wipe ALL tables? This cannot be undone. (y/n): ")
    if confirm.lower() == 'y':
        asyncio.run(reset_database())
    else:
        print("Reset cancelled.")
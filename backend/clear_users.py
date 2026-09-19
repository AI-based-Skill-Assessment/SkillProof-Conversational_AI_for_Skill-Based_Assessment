import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def clear_db():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres123@localhost:5433/skillproof")
    async with engine.begin() as conn:
        print("Clearing users...")
        await conn.execute(
            __import__('sqlalchemy').text("DELETE FROM users CASCADE;")
        )
        print("Users cleared.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(clear_db())

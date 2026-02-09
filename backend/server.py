from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class GameSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    score: int
    survival_time: float
    complexity_peak: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GameSessionCreate(BaseModel):
    score: int
    survival_time: float
    complexity_peak: float

class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    session_id: str
    score: int
    survival_time: float
    complexity_peak: float
    rank: Optional[int] = None


# Routes
@api_router.get("/")
async def root():
    return {"message": "Vast Unknown API"}

@api_router.post("/game/session", response_model=GameSession)
async def create_game_session(input: GameSessionCreate):
    session_dict = input.model_dump()
    session_obj = GameSession(**session_dict)
    
    doc = session_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.game_sessions.insert_one(doc)
    return session_obj

@api_router.get("/game/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(limit: int = 10):
    sessions = await db.game_sessions.find(
        {}, 
        {"_id": 0}
    ).sort("score", -1).limit(limit).to_list(limit)
    
    for idx, session in enumerate(sessions):
        if isinstance(session['timestamp'], str):
            session['timestamp'] = datetime.fromisoformat(session['timestamp'])
        session['rank'] = idx + 1
    
    return sessions

@api_router.get("/game/stats")
async def get_stats():
    total_games = await db.game_sessions.count_documents({})
    
    if total_games == 0:
        return {
            "total_games": 0,
            "avg_score": 0,
            "avg_survival_time": 0,
            "highest_score": 0
        }
    
    pipeline = [
        {
            "$group": {
                "_id": None,
                "avg_score": {"$avg": "$score"},
                "avg_survival_time": {"$avg": "$survival_time"},
                "max_score": {"$max": "$score"}
            }
        }
    ]
    
    result = await db.game_sessions.aggregate(pipeline).to_list(1)
    
    if result:
        stats = result[0]
        return {
            "total_games": total_games,
            "avg_score": round(stats['avg_score'], 1),
            "avg_survival_time": round(stats['avg_survival_time'], 1),
            "highest_score": stats['max_score']
        }
    
    return {
        "total_games": total_games,
        "avg_score": 0,
        "avg_survival_time": 0,
        "highest_score": 0
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from pymongo import MongoClient
from bson import ObjectId
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Meu Jovinho Game API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client.meu_jovinho_db
game_data_collection = db.game_data
leaderboard_collection = db.leaderboard

# Pydantic models
class GameData(BaseModel):
    player_id: str
    current_level: int
    max_level: int
    total_score: int
    items_collected: int
    games_played: int
    last_played: Optional[datetime] = None

class LeaderboardEntry(BaseModel):
    player_id: str
    player_name: str
    max_level: int
    total_score: int
    completion_time: Optional[str] = None
    created_at: Optional[datetime] = None

class GameSession(BaseModel):
    player_id: str
    level: int
    score: int
    items_collected: int
    completed: bool
    time_played: Optional[int] = None  # in seconds

@app.get("/api/")
def read_root():
    return {"message": "Meu Jovinho Game API is running!"}

@app.get("/api/health")
def health_check():
    try:
        # Test database connection
        client.admin.command('ismaster')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

# Game Data Management
@app.get("/api/game-data/{player_id}")
def get_game_data(player_id: str):
    """
    Get player's game progress and statistics
    """
    try:
        game_data = game_data_collection.find_one({"player_id": player_id})
        if not game_data:
            # Return default data for new player
            return {
                "player_id": player_id,
                "current_level": 1,
                "max_level": 1,
                "total_score": 0,
                "items_collected": 0,
                "games_played": 0,
                "last_played": None
            }
        
        # Convert ObjectId to string for JSON serialization
        game_data["_id"] = str(game_data["_id"])
        return game_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving game data: {str(e)}")

@app.post("/api/game-data")
def save_game_data(game_data: GameData):
    """
    Save or update player's game progress
    """
    try:
        game_data.last_played = datetime.now()
        
        # Update or insert game data
        result = game_data_collection.update_one(
            {"player_id": game_data.player_id},
            {"$set": game_data.dict()},
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Game data saved successfully",
            "modified_count": result.modified_count,
            "upserted_id": str(result.upserted_id) if result.upserted_id else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving game data: {str(e)}")

@app.post("/api/game-session")
def record_game_session(session: GameSession):
    """
    Record a completed game session
    """
    try:
        # Get current player data
        current_data = game_data_collection.find_one({"player_id": session.player_id})
        
        if not current_data:
            # Create new player data
            new_data = {
                "player_id": session.player_id,
                "current_level": session.level if session.completed else 1,
                "max_level": session.level if session.completed else 1,
                "total_score": session.score,
                "items_collected": session.items_collected,
                "games_played": 1,
                "last_played": datetime.now()
            }
        else:
            # Update existing player data
            new_data = {
                "player_id": session.player_id,
                "current_level": session.level if session.completed else current_data.get("current_level", 1),
                "max_level": max(session.level, current_data.get("max_level", 1)) if session.completed else current_data.get("max_level", 1),
                "total_score": current_data.get("total_score", 0) + session.score,
                "items_collected": current_data.get("items_collected", 0) + session.items_collected,
                "games_played": current_data.get("games_played", 0) + 1,
                "last_played": datetime.now()
            }
        
        # Save updated data
        game_data_collection.update_one(
            {"player_id": session.player_id},
            {"$set": new_data},
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Game session recorded successfully",
            "updated_data": new_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error recording game session: {str(e)}")

# Leaderboard Management
@app.get("/api/leaderboard")
def get_leaderboard(limit: int = 10):
    """
    Get top players leaderboard
    """
    try:
        # Get top players by max level, then by total score
        leaderboard = list(game_data_collection.find()
                          .sort([("max_level", -1), ("total_score", -1)])
                          .limit(limit))
        
        # Convert ObjectId to string and format data
        formatted_leaderboard = []
        for i, player in enumerate(leaderboard):
            formatted_leaderboard.append({
                "rank": i + 1,
                "player_id": player["player_id"],
                "max_level": player.get("max_level", 1),
                "total_score": player.get("total_score", 0),
                "items_collected": player.get("items_collected", 0),
                "games_played": player.get("games_played", 0),
                "last_played": player.get("last_played")
            })
        
        return {
            "leaderboard": formatted_leaderboard,
            "total_players": game_data_collection.count_documents({})
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving leaderboard: {str(e)}")

@app.get("/api/player-rank/{player_id}")
def get_player_rank(player_id: str):
    """
    Get specific player's rank in leaderboard
    """
    try:
        # Get player data
        player_data = game_data_collection.find_one({"player_id": player_id})
        if not player_data:
            return {"rank": None, "message": "Player not found"}
        
        # Count players with better stats
        better_players = game_data_collection.count_documents({
            "$or": [
                {"max_level": {"$gt": player_data.get("max_level", 1)}},
                {
                    "max_level": player_data.get("max_level", 1),
                    "total_score": {"$gt": player_data.get("total_score", 0)}
                }
            ]
        })
        
        rank = better_players + 1
        total_players = game_data_collection.count_documents({})
        
        return {
            "rank": rank,
            "total_players": total_players,
            "player_data": {
                "player_id": player_id,
                "max_level": player_data.get("max_level", 1),
                "total_score": player_data.get("total_score", 0),
                "items_collected": player_data.get("items_collected", 0),
                "games_played": player_data.get("games_played", 0)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving player rank: {str(e)}")

# Game Statistics
@app.get("/api/stats")
def get_game_statistics():
    """
    Get overall game statistics
    """
    try:
        total_players = game_data_collection.count_documents({})
        
        # Aggregate statistics
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total_score": {"$sum": "$total_score"},
                    "total_items_collected": {"$sum": "$items_collected"},
                    "total_games_played": {"$sum": "$games_played"},
                    "max_level_reached": {"$max": "$max_level"}
                }
            }
        ]
        
        stats_result = list(game_data_collection.aggregate(pipeline))
        
        if stats_result:
            stats = stats_result[0]
            return {
                "total_players": total_players,
                "total_score": stats.get("total_score", 0),
                "total_items_collected": stats.get("total_items_collected", 0),
                "total_games_played": stats.get("total_games_played", 0),
                "max_level_reached": stats.get("max_level_reached", 1),
                "average_score_per_player": stats.get("total_score", 0) / max(total_players, 1)
            }
        else:
            return {
                "total_players": 0,
                "total_score": 0,
                "total_items_collected": 0,
                "total_games_played": 0,
                "max_level_reached": 1,
                "average_score_per_player": 0
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving game statistics: {str(e)}")

# Admin endpoints
@app.delete("/api/admin/reset-player/{player_id}")
def reset_player_data(player_id: str):
    """
    Reset specific player's game data (admin function)
    """
    try:
        result = game_data_collection.delete_one({"player_id": player_id})
        
        return {
            "success": True,
            "message": f"Player {player_id} data reset successfully",
            "deleted_count": result.deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting player data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
#!/usr/bin/env python3
"""
Backend API Test Suite for Meu Jovinho Game
Tests all backend endpoints systematically
"""

import requests
import json
import time
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://meu-jovinho.preview.emergentagent.com/api"

class MeuJovinhoAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_player_id = "jovinho_player_1"
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def test_health_check(self):
        """Test health check endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("database") == "connected":
                    self.log_test("Health Check", True, f"Status: {data}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_get_new_player_data(self):
        """Test getting data for a new player (should return defaults)"""
        try:
            response = requests.get(f"{self.base_url}/game-data/{self.test_player_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_defaults = {
                    "player_id": self.test_player_id,
                    "current_level": 1,
                    "max_level": 1,
                    "total_score": 0,
                    "items_collected": 0,
                    "games_played": 0,
                    "last_played": None
                }
                
                # Check if all expected fields are present with correct default values
                all_correct = True
                for key, expected_value in expected_defaults.items():
                    if data.get(key) != expected_value:
                        all_correct = False
                        break
                
                if all_correct:
                    self.log_test("Get New Player Data", True, f"Correct defaults returned")
                    return True
                else:
                    self.log_test("Get New Player Data", False, f"Incorrect defaults: {data}")
                    return False
            else:
                self.log_test("Get New Player Data", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get New Player Data", False, f"Exception: {str(e)}")
            return False
    
    def test_save_game_data(self):
        """Test saving game progress"""
        try:
            game_data = {
                "player_id": self.test_player_id,
                "current_level": 3,
                "max_level": 3,
                "total_score": 150,
                "items_collected": 25,
                "games_played": 5
            }
            
            response = requests.post(f"{self.base_url}/game-data", 
                                   json=game_data, 
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "Game data saved successfully" in data.get("message", ""):
                    self.log_test("Save Game Data", True, f"Data saved successfully")
                    return True
                else:
                    self.log_test("Save Game Data", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Save Game Data", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Save Game Data", False, f"Exception: {str(e)}")
            return False
    
    def test_get_saved_player_data(self):
        """Test retrieving saved player data"""
        try:
            response = requests.get(f"{self.base_url}/game-data/{self.test_player_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if saved data matches what we saved
                expected_values = {
                    "player_id": self.test_player_id,
                    "current_level": 3,
                    "max_level": 3,
                    "total_score": 150,
                    "items_collected": 25,
                    "games_played": 5
                }
                
                all_correct = True
                for key, expected_value in expected_values.items():
                    if data.get(key) != expected_value:
                        all_correct = False
                        break
                
                if all_correct and data.get("last_played") is not None:
                    self.log_test("Get Saved Player Data", True, f"Saved data retrieved correctly")
                    return True
                else:
                    self.log_test("Get Saved Player Data", False, f"Data mismatch: {data}")
                    return False
            else:
                self.log_test("Get Saved Player Data", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Saved Player Data", False, f"Exception: {str(e)}")
            return False
    
    def test_record_game_sessions(self):
        """Test recording multiple game sessions"""
        sessions = [
            {
                "player_id": self.test_player_id,
                "level": 4,
                "score": 75,
                "items_collected": 12,
                "completed": True,
                "time_played": 120
            },
            {
                "player_id": self.test_player_id,
                "level": 5,
                "score": 100,
                "items_collected": 15,
                "completed": True,
                "time_played": 180
            },
            {
                "player_id": self.test_player_id,
                "level": 6,
                "score": 50,
                "items_collected": 8,
                "completed": False,
                "time_played": 90
            }
        ]
        
        success_count = 0
        for i, session in enumerate(sessions):
            try:
                response = requests.post(f"{self.base_url}/game-session", 
                                       json=session, 
                                       timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        success_count += 1
                    else:
                        self.log_test(f"Record Game Session {i+1}", False, f"Session not recorded: {data}")
                else:
                    self.log_test(f"Record Game Session {i+1}", False, f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test(f"Record Game Session {i+1}", False, f"Exception: {str(e)}")
        
        if success_count == len(sessions):
            self.log_test("Record Game Sessions", True, f"All {len(sessions)} sessions recorded")
            return True
        else:
            self.log_test("Record Game Sessions", False, f"Only {success_count}/{len(sessions)} sessions recorded")
            return False
    
    def test_leaderboard(self):
        """Test leaderboard endpoint"""
        try:
            response = requests.get(f"{self.base_url}/leaderboard", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if "leaderboard" in data and "total_players" in data:
                    leaderboard = data["leaderboard"]
                    
                    # Check if our test player is in the leaderboard
                    player_found = False
                    for entry in leaderboard:
                        if entry.get("player_id") == self.test_player_id:
                            player_found = True
                            # Check if ranking is by level then score
                            if entry.get("max_level") >= 5:  # Should be 5 after sessions
                                break
                    
                    if player_found:
                        self.log_test("Leaderboard", True, f"Leaderboard working, {len(leaderboard)} players shown")
                        return True
                    else:
                        self.log_test("Leaderboard", False, f"Test player not found in leaderboard")
                        return False
                else:
                    self.log_test("Leaderboard", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Leaderboard", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Leaderboard", False, f"Exception: {str(e)}")
            return False
    
    def test_player_rank(self):
        """Test player rank endpoint"""
        try:
            response = requests.get(f"{self.base_url}/player-rank/{self.test_player_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if "rank" in data and "total_players" in data and "player_data" in data:
                    rank = data["rank"]
                    player_data = data["player_data"]
                    
                    # Check if player data is correct
                    if (player_data.get("player_id") == self.test_player_id and 
                        player_data.get("max_level") >= 5):  # Should be 5 after sessions
                        self.log_test("Player Rank", True, f"Player rank: {rank}, data correct")
                        return True
                    else:
                        self.log_test("Player Rank", False, f"Incorrect player data: {player_data}")
                        return False
                else:
                    self.log_test("Player Rank", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Player Rank", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Player Rank", False, f"Exception: {str(e)}")
            return False
    
    def test_game_statistics(self):
        """Test game statistics endpoint"""
        try:
            response = requests.get(f"{self.base_url}/stats", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                required_fields = ["total_players", "total_score", "total_items_collected", 
                                 "total_games_played", "max_level_reached", "average_score_per_player"]
                
                all_fields_present = all(field in data for field in required_fields)
                
                if all_fields_present:
                    # Check if stats make sense (should have at least our test player's data)
                    if (data["total_players"] >= 1 and 
                        data["total_score"] > 0 and 
                        data["max_level_reached"] >= 5):
                        self.log_test("Game Statistics", True, f"Stats calculated correctly")
                        return True
                    else:
                        self.log_test("Game Statistics", False, f"Stats seem incorrect: {data}")
                        return False
                else:
                    self.log_test("Game Statistics", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Game Statistics", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Game Statistics", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_reset_player(self):
        """Test admin reset player endpoint"""
        try:
            # First create a test player to reset
            test_reset_player = "test_reset_player"
            
            # Save some data for this player
            game_data = {
                "player_id": test_reset_player,
                "current_level": 2,
                "max_level": 2,
                "total_score": 50,
                "items_collected": 10,
                "games_played": 2
            }
            
            save_response = requests.post(f"{self.base_url}/game-data", json=game_data, timeout=10)
            
            if save_response.status_code != 200:
                self.log_test("Admin Reset Player", False, "Failed to create test player for reset")
                return False
            
            # Now reset the player
            response = requests.delete(f"{self.base_url}/admin/reset-player/{test_reset_player}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and data.get("deleted_count") == 1:
                    # Verify player data is gone by trying to get it
                    verify_response = requests.get(f"{self.base_url}/game-data/{test_reset_player}", timeout=10)
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        # Should return default data for new player
                        if verify_data.get("total_score") == 0 and verify_data.get("games_played") == 0:
                            self.log_test("Admin Reset Player", True, "Player data reset successfully")
                            return True
                        else:
                            self.log_test("Admin Reset Player", False, "Player data not properly reset")
                            return False
                    else:
                        self.log_test("Admin Reset Player", False, "Failed to verify reset")
                        return False
                else:
                    self.log_test("Admin Reset Player", False, f"Reset failed: {data}")
                    return False
            else:
                self.log_test("Admin Reset Player", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Reset Player", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print(f"🚀 Starting Meu Jovinho Backend API Tests")
        print(f"Backend URL: {self.base_url}")
        print(f"Test Player ID: {self.test_player_id}")
        print("=" * 60)
        
        # Run tests in logical order
        tests = [
            self.test_health_check,
            self.test_get_new_player_data,
            self.test_save_game_data,
            self.test_get_saved_player_data,
            self.test_record_game_sessions,
            self.test_leaderboard,
            self.test_player_rank,
            self.test_game_statistics,
            self.test_admin_reset_player
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error: {str(e)}")
                failed += 1
            
            # Small delay between tests
            time.sleep(0.5)
        
        print("=" * 60)
        print(f"📊 Test Results Summary:")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print("\n🔍 Failed Tests Details:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
        
        return passed, failed

if __name__ == "__main__":
    tester = MeuJovinhoAPITester()
    passed, failed = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    exit(0 if failed == 0 else 1)
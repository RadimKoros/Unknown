import requests
import sys
from datetime import datetime
import json
import time

class VastUnknownAPITester:
    def __init__(self, base_url="https://void-navigator-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None
        
    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        return success

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"- Status: {response.status_code}"
            if success:
                data = response.json()
                details += f" - Message: {data.get('message', 'No message')}"
            return self.log_test("API Root", success, details)
        except Exception as e:
            return self.log_test("API Root", False, f"- Error: {str(e)}")

    def test_create_game_session(self):
        """Test creating a game session"""
        try:
            payload = {
                "score": 150,
                "survival_time": 25.5,
                "complexity_peak": 87.5
            }
            
            response = requests.post(
                f"{self.api_url}/game/session", 
                json=payload, 
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            success = response.status_code in [200, 201]
            details = f"- Status: {response.status_code}"
            
            if success:
                data = response.json()
                self.session_id = data.get('session_id')
                details += f" - Session ID: {self.session_id[:8]}... - Score: {data.get('score')}"
            else:
                try:
                    error_data = response.json()
                    details += f" - Error: {error_data}"
                except:
                    details += f" - Response: {response.text[:100]}"
                    
            return self.log_test("Create Game Session", success, details)
        except Exception as e:
            return self.log_test("Create Game Session", False, f"- Error: {str(e)}")

    def test_get_leaderboard(self):
        """Test getting leaderboard"""
        try:
            response = requests.get(f"{self.api_url}/game/leaderboard?limit=5", timeout=10)
            success = response.status_code == 200
            details = f"- Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" - Entries: {len(data)} - Type: {type(data).__name__}"
                if data and isinstance(data, list):
                    first_entry = data[0]
                    details += f" - Top Score: {first_entry.get('score', 'N/A')}"
            else:
                try:
                    error_data = response.json()
                    details += f" - Error: {error_data}"
                except:
                    details += f" - Response: {response.text[:100]}"
                    
            return self.log_test("Get Leaderboard", success, details)
        except Exception as e:
            return self.log_test("Get Leaderboard", False, f"- Error: {str(e)}")

    def test_get_stats(self):
        """Test getting game stats"""
        try:
            response = requests.get(f"{self.api_url}/game/stats", timeout=10)
            success = response.status_code == 200
            details = f"- Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" - Total Games: {data.get('total_games', 'N/A')}"
                details += f" - Avg Score: {data.get('avg_score', 'N/A')}"
                details += f" - Highest Score: {data.get('highest_score', 'N/A')}"
            else:
                try:
                    error_data = response.json()
                    details += f" - Error: {error_data}"
                except:
                    details += f" - Response: {response.text[:100]}"
                    
            return self.log_test("Get Game Stats", success, details)
        except Exception as e:
            return self.log_test("Get Game Stats", False, f"- Error: {str(e)}")

    def test_invalid_session_data(self):
        """Test creating session with invalid data"""
        try:
            # Test missing required fields
            payload = {"score": "invalid"}  # Invalid score type
            
            response = requests.post(
                f"{self.api_url}/game/session", 
                json=payload, 
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            success = response.status_code in [400, 422]  # Should return validation error
            details = f"- Status: {response.status_code} (Expected 400/422 for validation error)"
            
            if not success:
                details += f" - Unexpected success with invalid data"
                    
            return self.log_test("Invalid Session Data Validation", success, details)
        except Exception as e:
            return self.log_test("Invalid Session Data Validation", False, f"- Error: {str(e)}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🎮 Starting Vast Unknown API Tests")
        print("=" * 50)
        
        # Test API availability
        print("\n📡 Testing API Connectivity...")
        api_available = self.test_api_root()
        
        if not api_available:
            print("\n❌ API not available. Stopping tests.")
            return False
            
        # Test core functionality
        print("\n🎯 Testing Game Session APIs...")
        self.test_create_game_session()
        
        print("\n🏆 Testing Leaderboard & Stats...")
        self.test_get_leaderboard()
        self.test_get_stats()
        
        print("\n🔍 Testing Error Handling...")
        self.test_invalid_session_data()
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} test(s) failed")
            return False

def main():
    tester = VastUnknownAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
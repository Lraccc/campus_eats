#!/bin/bash
# Location API Testing Script
# This script tests the location tracking endpoints

API_BASE="http://localhost:8080/api/orders"
ORDER_ID="test_order_123"

echo "==================================="
echo "Location API Testing Script"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

run_test() {
    test_count=$((test_count + 1))
    local test_name="$1"
    local expected_status="$2"
    shift 2
    
    echo -e "${YELLOW}Test $test_count: $test_name${NC}"
    
    response=$(curl -s -w "\n%{http_code}" "$@")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        pass_count=$((pass_count + 1))
        if [ -n "$body" ]; then
            echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $http_code)"
        fail_count=$((fail_count + 1))
        if [ -n "$body" ]; then
            echo "Response: $body"
        fi
    fi
    echo ""
}

echo "Testing Location API Endpoints..."
echo ""

# Test 1: Store valid user location
run_test "Store valid user location" "200" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 10.2944327, "longitude": 123.8812167}'

# Test 2: Store valid dasher location
run_test "Store valid dasher location" "200" \
    -X POST "$API_BASE/$ORDER_ID/location/dasher" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 10.3, "longitude": 123.9}'

# Test 3: Get user location
run_test "Get user location" "200" \
    -X GET "$API_BASE/$ORDER_ID/location/user"

# Test 4: Get dasher location
run_test "Get dasher location" "200" \
    -X GET "$API_BASE/$ORDER_ID/location/dasher"

# Test 5: Invalid latitude (too high)
run_test "Reject latitude > 90" "400" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 91.0, "longitude": 120.0}'

# Test 6: Invalid latitude (too low)
run_test "Reject latitude < -90" "400" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": -91.0, "longitude": 120.0}'

# Test 7: Invalid longitude (too high)
run_test "Reject longitude > 180" "400" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 10.0, "longitude": 181.0}'

# Test 8: Invalid longitude (too low)
run_test "Reject longitude < -180" "400" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 10.0, "longitude": -181.0}'

# Test 9: Missing latitude
run_test "Reject missing latitude" "400" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"longitude": 120.0}'

# Test 10: Missing longitude
run_test "Reject missing longitude" "400" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 10.0}'

# Test 11: Invalid userType
run_test "Reject invalid userType" "400" \
    -X POST "$API_BASE/$ORDER_ID/location/invalid_type" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 10.0, "longitude": 120.0}'

# Test 12: Boundary value - latitude minimum
run_test "Accept latitude = -90" "200" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": -90.0, "longitude": 0.0}'

# Test 13: Boundary value - latitude maximum
run_test "Accept latitude = 90" "200" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 90.0, "longitude": 0.0}'

# Test 14: Boundary value - longitude minimum
run_test "Accept longitude = -180" "200" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 0.0, "longitude": -180.0}'

# Test 15: Boundary value - longitude maximum
run_test "Accept longitude = 180" "200" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 0.0, "longitude": 180.0}'

# Test 16: Get non-existent location
run_test "Get non-existent location (404)" "404" \
    -X GET "$API_BASE/nonexistent_order/location/user"

# Test 17: Update existing location
run_test "Update existing user location" "200" \
    -X POST "$API_BASE/$ORDER_ID/location/user" \
    -H "Content-Type: application/json" \
    -d '{"latitude": 11.0, "longitude": 124.0}'

# Summary
echo "==================================="
echo "Test Results Summary"
echo "==================================="
echo "Total tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi

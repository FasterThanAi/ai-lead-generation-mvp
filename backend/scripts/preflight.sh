#!/usr/bin/env bash

# SpecForge Production Preflight Checklist
# Usage: ./scripts/preflight.sh [BASE_URL]
# Example: ./scripts/preflight.sh https://specforge-backend.onrender.com

BASE_URL="${1:-http://127.0.0.1:8000}"
# Trim trailing slash
BASE_URL="${BASE_URL%/}"

echo "================================================================"
echo "  🚀 SpecForge Production Preflight Verification"
echo "  Target Host: ${BASE_URL}"
echo "================================================================"
printf "\n%-35s %-12s %-10s\n" "ENDPOINT" "HTTP STATUS" "RESULT"
echo "----------------------------------------------------------------"

TOTAL=0
PASSED=0
FAILED=0

check_endpoint() {
    local path="$1"
    local full_url="${BASE_URL}${path}"
    TOTAL=$((TOTAL + 1))

    # Fetch HTTP status code with 10s timeout
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${full_url}" 2>/dev/null)

    if [ "${status_code}" -eq 200 ]; then
        printf "%-35s %-12s \033[0;32m%-10s\033[0m\n" "${path}" "${status_code}" "PASS ✓"
        PASSED=$((PASSED + 1))
    else
        printf "%-35s %-12s \033[0;31m%-10s\033[0m\n" "${path}" "${status_code:-ERR}" "FAIL ✗"
        FAILED=$((FAILED + 1))
    fi
}

# 1. Health Checks
check_endpoint "/health"
check_endpoint "/health/deep"

# 2. Analytics & Telemetry
check_endpoint "/api/dashboard/stats"

# 3. Catalog & Products
check_endpoint "/api/catalogs/"
check_endpoint "/api/products/"

# 4. Export Engine
check_endpoint "/api/catalogs/1/export.csv"
check_endpoint "/api/catalogs/1/export.json"

echo "----------------------------------------------------------------"
echo "  Summary: ${PASSED}/${TOTAL} endpoints passed (${FAILED} failed)"
echo "================================================================"

if [ "${FAILED}" -eq 0 ]; then
    echo -e "\033[0;32m🎉 PREFLIGHT VERIFICATION PASSED! SYSTEM IS DEPLOYMENT-READY.\033[0m\n"
    exit 0
else
    echo -e "\033[0;31m⚠️ PREFLIGHT FAILED ON ${FAILED} ENDPOINTS. CHECK LOGS.\033[0m\n"
    exit 1
fi

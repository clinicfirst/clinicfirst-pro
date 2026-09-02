#!/bin/bash
BASE_URL="https://clinicfirst.vercel.app"
ADMIN_TOKEN=$(cat admin_token.txt)
CLINIC_TOKEN=$(cat clinic_admin_token.txt)

echo "1. Health Check:"
curl -s $BASE_URL/api/health
echo -e "\n"

echo "2. Compile (Initial):"
COMPILE_RES=$(curl -s -X POST -H "Authorization: Bearer $CLINIC_TOKEN" $BASE_URL/api/compiler/clinic_apex_101/compile)
echo $COMPILE_RES
echo -e "\n"

echo "3. Compile (Duplicate):"
COMPILE_DUP=$(curl -s -X POST -H "Authorization: Bearer $CLINIC_TOKEN" $BASE_URL/api/compiler/clinic_apex_101/compile)
echo $COMPILE_DUP
echo -e "\n"

echo "4. Harmless Change (Update Phone):"
curl -s -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"phone": "+1-555-019-9999"}' $BASE_URL/api/platform/clinics/clinic_apex_101 > /dev/null
echo "Updated phone."
echo -e "\n"

echo "5. Compile (After Change):"
COMPILE_NEW=$(curl -s -X POST -H "Authorization: Bearer $CLINIC_TOKEN" $BASE_URL/api/compiler/clinic_apex_101/compile)
echo $COMPILE_NEW
RELEASE_ID=$(echo $COMPILE_NEW | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Extracted Release ID: $RELEASE_ID"
echo -e "\n"

echo "6. Publish:"
if [ ! -z "$RELEASE_ID" ]; then
  curl -s -X POST -H "Authorization: Bearer $CLINIC_TOKEN" $BASE_URL/api/compiler/clinic_apex_101/releases/$RELEASE_ID/publish
else
  echo "No release ID found to publish."
fi
echo -e "\n"

echo "7. Tenant Isolation:"
curl -s -X POST -H "Authorization: Bearer $CLINIC_TOKEN" $BASE_URL/api/compiler/clinic_vitality_202/compile
echo -e "\n"

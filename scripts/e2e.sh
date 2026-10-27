#!/usr/bin/env bash
# A walk through the whole flow against a running API, from the flyer to the
# export. Needs a seeded database and the API started with MAIL_PROVIDER=console,
# its output redirected to $API_LOG.
#
#   pnpm db:seed
#   API_LOG=/tmp/one-accord-api.log
#   node apps/api/dist/main.js > $API_LOG 2>&1 &
#   bash scripts/e2e.sh
#
# It registers, boards, departs, arrives and exports. It takes seats and
# departs a bus, so it expects a freshly seeded database and will say so if it
# finds one that an earlier run already used up:
#
#   pnpm db:reset && pnpm db:seed
set -uo pipefail

API=${API_BASE:-http://127.0.0.1:3000/api}
ORIGIN=${ORIGIN:-http://127.0.0.1:3000}
# The API log, where the console mail provider prints magic links.
LOG="${API_LOG:-/tmp/one-accord-api.log}"
pass=0; fail=0

j() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);const r=process.argv[1].split('.').reduce((a,k)=>a==null?a:a[k],v);console.log(r===undefined?'':typeof r==='object'?JSON.stringify(r):r)}catch(e){console.log('')}})" "$1"; }

check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "  PASS  $1"; pass=$((pass+1));
  else echo "  FAIL  $1 — expected [$2], got [$3]"; fail=$((fail+1)); fi
}

# Sign a team member in by magic link and return the session token. The link
# redirects to the app with the session in the URL fragment, which is what an
# app on another site reads; no cookie is used anywhere in this walk.
#
# This is called as `X=$(sign_in ...)`, which runs it in a subshell, so it can
# keep no state between calls. It counts the links already in the log and waits
# for a new one rather than comparing against a variable the parent never sees.
sign_in() { # email -> prints the bearer token
  local email="$1" resp before after link landing
  before=$(grep -c 'auth/callback?token=' "$LOG" 2>/dev/null || true)
  : "${before:=0}"

  resp=$(curl -s -X POST $API/auth/magic-link -H 'content-type: application/json' -d "{\"email\":\"$email\"}")
  if [ "$(echo "$resp" | j statusCode)" = "429" ]; then
    echo >&2
    echo "  Rate limited on sign-in, which is the throttle doing its job: five" >&2
    echo "  magic links per five minutes. The counter is in memory, so restart" >&2
    echo "  the API and run this again, or wait it out." >&2
    echo >&2
    exit 1
  fi

  # The outbox sweep runs every couple of seconds, so wait for the new link.
  for i in $(seq 1 80); do
    after=$(grep -c 'auth/callback?token=' "$LOG" 2>/dev/null || true)
    : "${after:=0}"
    [ "$after" -gt "$before" ] && break
    sleep 0.25
  done
  if [ "${after:-0}" -le "$before" ]; then
    echo "  No sign-in link for $email reached $LOG." >&2
    exit 1
  fi

  link=$(grep -o 'http://[^ ]*auth/callback?token=[A-Za-z0-9_-]*' "$LOG" | tail -1)
  landing=$(curl -s -o /dev/null -w '%{redirect_url}' "$link")
  case "$landing" in
    *'#t='*) printf '%s' "${landing#*#t=}" ;;
    *)
      echo "  Sign-in for $email did not come back with a session: $landing" >&2
      exit 1
      ;;
  esac
}

# Every authenticated call goes through here, bearer only.
as() { # token  then curl args
  local token="$1"; shift
  curl -s -H "Authorization: Bearer $token" "$@"
}

echo "== 1. Health =="
h=$(curl -s $ORIGIN/health)
check "database up" "up" "$(echo "$h" | j database)"
# Mail is queued in Postgres now; a number that only climbs means the
# provider is refusing and passes are not arriving.
check "mail queue readable" "yes" "$([ -n "$(echo "$h" | j mailWaiting)" ] && echo yes || echo no)"

echo "== 2. The event the flyer points at =="
ev=$(curl -s $API/events/lagos-2026/public)
EVENT_ID=$(echo "$ev" | j event.id)
check "city" "Lagos" "$(echo "$ev" | j event.city)"
echo "  event id $EVENT_ID"
POINT_ID=$(echo "$ev" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);const p=v.pickupPoints.find(x=>x.name.startsWith('UNILAG'));console.log(p.id)})")

echo "== 3. Ada registers (RG-1, RG-2) =="
reg=$(curl -s -X POST $API/events/$EVENT_ID/registrations -H 'content-type: application/json' \
  -d "{\"fullName\":\"Ada Test\",\"email\":\"ada.test+$$@example.com\",\"type\":\"CAMPUS\",\"pickupPointId\":\"$POINT_ID\",\"consentData\":true,\"consentEmail\":true}")
if [ "$(echo "$reg" | j error)" = "PICKUP_FULL" ]; then
  echo
  echo "  Every trip from UNILAG is full, which is RG-5 working correctly:"
  echo "  an earlier run of this script took the last seats and departed the bus."
  echo "  This walk expects a freshly seeded database."
  echo
  echo "      pnpm db:reset && pnpm db:seed"
  echo
  exit 1
fi
PASS_CODE=$(echo "$reg" | j passCode)
TRIP_CODE=$(echo "$reg" | j trip.code)
check "got a pass code" "UR-" "${PASS_CODE:0:3}"
check "placed on a trip" "12" "${TRIP_CODE:0:2}"
echo "  pass $PASS_CODE on trip $TRIP_CODE"

echo "== 4. Registering again resends, never duplicates (RG-3) =="
again=$(curl -s -X POST $API/events/$EVENT_ID/registrations -H 'content-type: application/json' \
  -d "{\"fullName\":\"Ada Test\",\"email\":\"ada.test+$$@example.com\",\"type\":\"CAMPUS\",\"pickupPointId\":\"$POINT_ID\",\"consentData\":true,\"consentEmail\":true}")
check "same pass code back" "$PASS_CODE" "$(echo "$again" | j passCode)"
check "flagged as resent" "true" "$(echo "$again" | j resent)"

echo "== 5. Opening the pass stamps the phone (PS-2) =="
view=$(curl -s $API/passes/$PASS_CODE/view)
DEVICE=$(echo "$view" | j deviceToken)
check "pass page names her" "Ada Test" "$(echo "$view" | j fullName)"
check "phone given a device token" "yes" "$([ -n "$DEVICE" ] && echo yes || echo no)"

echo "== 6. The delegate signs in (EV-5) =="
DELEGATE=$(sign_in tolu@oneaccord.example)
me=$(as "$DELEGATE" $API/auth/me)
check "signed in as delegate" "DELEGATE" "$(echo "$me" | j role)"

echo "== 7. The rotating boarding code (BD-1) =="
trips=$(as "$DELEGATE" $API/trips/mine)
TRIP_ID=$(echo "$trips" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);console.log(v.find(t=>t.code==='$TRIP_CODE')?.id??v[0].id)})")
code=$(as "$DELEGATE" $API/trips/$TRIP_ID/boarding-code)
TOKEN=$(echo "$code" | j token)
check "token issued" "yes" "$([ -n "$TOKEN" ] && echo yes || echo no)"
BEFORE=$(echo "$code" | j boardedCount)
echo "  $(echo "$code" | j boardedCount) already on board"

echo "== 8. Ada scans it (BD-2) =="
ctx=$(as "$DEVICE" "$API/checkins/context?token=$TOKEN")
check "code is valid" "true" "$(echo "$ctx" | j valid)"
check "phone is recognised" "Ada Test" "$(echo "$ctx" | j attendee.fullName)"
in1=$(as "$DEVICE" -X POST $API/checkins/boarding -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}")
check "checked in" "false" "$(echo "$in1" | j alreadyCheckedIn)"
check "told her zone (BD-7)" "C" "$(echo "$in1" | j zone.letter)"
check "named her delegate" "Tolu" "$(echo "$in1" | j delegateFirstName)"

echo "== 9. Scanning twice changes nothing (data integrity) =="
in2=$(as "$DEVICE" -X POST $API/checkins/boarding -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}")
check "second scan is a no-op" "true" "$(echo "$in2" | j alreadyCheckedIn)"
after=$(as "$DELEGATE" $API/trips/$TRIP_ID/boarding-code)
check "count rose by exactly one" "$((BEFORE+1))" "$(echo "$after" | j boardedCount)"

echo "== 10. An old code is refused (BD-4) =="
OLD=$(node -e "
const {createHmac}=require('crypto');
const secret=process.env.APP_SECRET||'dev-secret-change-me-before-any-real-event';
const w=Math.floor(Date.now()/1000/30)-5;
const body='b:$TRIP_ID:'+w;
const sig=createHmac('sha256',secret).update(body).digest('base64url').slice(0,22);
console.log(Buffer.from(body,'utf8').toString('base64url')+'.'+sig);
")
old=$(as "$DEVICE" -X POST $API/checkins/boarding -H 'content-type: application/json' -d "{\"token\":\"$OLD\"}")
check "expired code rejected" "EXPIRED" "$(echo "$old" | j error)"

echo "== 11. A forged code is refused (security) =="
forged=$(curl -s -X POST $API/checkins/boarding -H 'content-type: application/json' -d '{"token":"YjpmYWtlOjE=.notarealsignature00"}')
check "bad signature rejected" "400" "$(echo "$forged" | j statusCode)"

echo "== 12. The delegate checks in someone by name (BD-5) =="
manifest=$(as "$DELEGATE" $API/trips/$TRIP_ID/manifest)
WAITING=$(echo "$manifest" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);console.log((v.find(r=>!r.boarded)||{}).registrationId||'')})")
byname=$(as "$DELEGATE" -X POST $API/checkins/by-name -H 'content-type: application/json' -d "{\"tripId\":\"$TRIP_ID\",\"registrationId\":\"$WAITING\"}")
check "checked in by name" "BOARDED" "$(echo "$byname" | j stage)"

echo "== 13. Depart locks the trip (BD-8) =="
dep=$(as "$DELEGATE" -X POST $API/trips/$TRIP_ID/depart)
check "trip departed" "DEPARTED" "$(echo "$dep" | j status)"
late=$(as "$DEVICE" -X POST $API/checkins/boarding -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}")
check "late scan refused" "TRIP_LOCKED" "$(echo "$late" | j error)"

echo "== 14. The usher confirms the whole trip in one tap (GT-1) =="
USHER=$(sign_in usher@oneaccord.example)
check "signed in as usher" "USHER" "$(as "$USHER" $API/auth/me | j role)"
arr=$(as "$USHER" -X POST $API/trips/$TRIP_ID/arrive)
ARRIVED=$(echo "$arr" | j arrived)
check "whole trip marked arrived" "$((BEFORE+2))" "$ARRIVED"

echo "== 15. The admin signs in =="
ADMIN=$(sign_in admin@oneaccord.example)
check "signed in as admin" "SUPER_ADMIN" "$(as "$ADMIN" $API/auth/me | j role)"

# Move the doors about, so this run does not depend on what an earlier one left.
doors() {
  node -e "
const e=JSON.parse(process.argv[1]).event;
const now=Date.now();
console.log(JSON.stringify({slug:e.slug,city:e.city,venue:e.venue,startsAt:e.startsAt,
  doorsOpenAt:new Date(now+Number(process.argv[2])).toISOString(),
  doorsCloseAt:new Date(now+Number(process.argv[3])).toISOString(),
  status:'LIVE'}));" "$ev" "$1" "$2"
}
set_doors() {
  as "$ADMIN" -X PATCH $API/events/$EVENT_ID -H 'content-type: application/json' -d "$(doors "$1" "$2")" > /dev/null
}

echo "== 15a. The poster is dead outside the doors' hours (GT-3) =="
set_doors 7200000 21600000   # opens in two hours
GATE=$(as "$USHER" $API/events/$EVENT_ID/gates | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);console.log(v[0].posterUrl.split('/g/')[1])})")
shut=$(curl -s -X POST $API/checkins/gate -H 'content-type: application/json' -d "{\"token\":\"$GATE\",\"passCode\":\"$PASS_CODE\"}")
check "refused before the doors open" "OUTSIDE_HOURS" "$(echo "$shut" | j error)"

echo "== 15b. The doors open, and the poster works (GT-2, ZN-2) =="
set_doors -3600000 18000000  # opened an hour ago
priv=$(curl -s -X POST $API/events/$EVENT_ID/registrations -H 'content-type: application/json'   -d "{\"fullName\":\"Private Guest\",\"email\":\"private+$$@example.com\",\"type\":\"PRIVATE\",\"consentData\":true,\"consentEmail\":true}")
PRIV_CODE=$(echo "$priv" | j passCode)
check "private attendee has no trip" "null" "$(echo "$priv" | j trip.code)"
pv=$(curl -s -X POST $API/checkins/gate -H 'content-type: application/json' -d "{\"token\":\"$GATE\",\"passCode\":\"$PRIV_CODE\"}")
check "gate check-in works" "ARRIVED" "$(echo "$pv" | j stage)"
check "given the emptiest zone (ZN-2)" "yes" "$([ -n "$(echo "$pv" | j zone.letter)" ] && echo yes || echo no)"

echo "== 16. A walk-in registers and is in at once (GT-4) =="
wi=$(curl -s -X POST $API/checkins/walk-in -H 'content-type: application/json' \
  -d "{\"token\":\"$GATE\",\"fullName\":\"Walk In\",\"email\":\"walkin+$$@example.com\",\"consentData\":true,\"consentEmail\":false}")
check "walk-in checked in" "ARRIVED" "$(echo "$wi" | j stage)"
check "walk-in got a zone" "yes" "$([ -n "$(echo "$wi" | j zone.letter)" ] && echo yes || echo no)"

echo "== 17. The live dashboard (DB-1, DB-2) =="
live=$(as "$USHER" $API/events/$EVENT_ID/live)
check "registered counted" "yes" "$([ "$(echo "$live" | j totals.registered)" -gt 380 ] && echo yes || echo no)"
check "arrived counted" "yes" "$([ "$(echo "$live" | j totals.arrived)" -ge "$ARRIVED" ] && echo yes || echo no)"
echo "  totals: $(echo "$live" | j totals)"

echo "== 18. Export (DB-4) =="
csv=$(as "$DELEGATE" "$API/events/$EVENT_ID/export")
check "delegates cannot export" "403" "$(echo "$csv" | j statusCode)"
admincsv=$(as "$ADMIN" "$API/events/$EVENT_ID/export")
# Read the first line with parameter expansion rather than `| head -1`:
# head closes the pipe after one line, echo takes SIGPIPE, and on Linux the
# check reads as a failure even when the header is there.
header=${admincsv%%$'
'*}
case "$header" in
  *'Pass code,Full name'*) header_ok=yes ;;
  *) header_ok=no ;;
esac
check "admin export has a header row" "yes" "$header_ok"
check "export has a row per attendee" "yes" "$([ "$(echo "$admincsv" | wc -l)" -gt 380 ] && echo yes || echo no)"
check "export records the boarded trip" "yes" "$(echo "$admincsv" | grep -q "$PASS_CODE" && echo yes || echo no)"

echo "== 19. An attendee has their details removed (privacy) =="
wrong=$(curl -s -X POST $API/passes/$PRIV_CODE/forget -H 'content-type: application/json' -d '{"email":"someone.else@example.com"}')
check "wrong email refused" "404" "$(echo "$wrong" | j statusCode)"
gone=$(curl -s -X POST $API/passes/$PRIV_CODE/forget -H 'content-type: application/json' -d "{\"email\":\"private+$$@example.com\"}")
check "details removed" "true" "$(echo "$gone" | j removed)"
after_forget=$(curl -s $API/passes/$PRIV_CODE/view)
check "name is gone from the pass" "Removed at their request" "$(echo "$after_forget" | j fullName)"
still=$(as "$ADMIN" $API/events/$EVENT_ID/live)
check "the arrival still counts" "yes" "$([ "$(echo "$still" | j totals.arrived)" -ge "$ARRIVED" ] && echo yes || echo no)"

echo
echo "passed $pass, failed $fail"

[ "$fail" -eq 0 ]

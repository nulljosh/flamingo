#!/bin/sh
# iOS QA screenshots from a booted simulator: sh scripts/ios-shots.sh <device-udid> [out-dir]
# Each scene relaunches the app with QA launch arguments (see RootView.qa and Store.init). ONLY="map place" runs just those scenes.
D=$1; OUT=${2:-docs/img/qa}; APP=com.nulljosh.flamingo
mkdir -p "$OUT"
shot() { # name, theme, args...
  name=$1; theme=$2; shift 2
  [ -n "$ONLY" ] && case " $ONLY " in *" $name "*) ;; *) return ;; esac
  xcrun simctl ui "$D" appearance "$theme" >/dev/null 2>&1
  xcrun simctl terminate "$D" $APP >/dev/null 2>&1
  xcrun simctl launch "$D" $APP "$@" >/dev/null
  sleep ${WAIT:-7}   # WAIT=20 on a slow simulator
  xcrun simctl io "$D" screenshot --type=png "$OUT/ios-$name-$theme.png" >/dev/null 2>&1 && echo "PASS ios-$name-$theme" || echo "FAIL ios-$name-$theme"
}
for t in light dark; do
  T=-qaLight; [ $t = dark ] && T=-qaDark
  # warm up: the first launch after an appearance change is slow
  xcrun simctl ui "$D" appearance "$t" >/dev/null 2>&1; xcrun simctl launch "$D" $APP $T >/dev/null; sleep 8
  shot map $t $T
  shot hint $t $T -qaHint
  shot vicecity $t $T -qaZoom 866,612,5.2
  SIMCTL_CHILD_QA_QUERY=garage; export SIMCTL_CHILD_QA_QUERY
  shot search $t $T -qaRoute search
  shot searchmap $t $T -qaRoute search -qaShowHits
  unset SIMCTL_CHILD_QA_QUERY
  shot place $t $T -qaVisited -qaRoute place/shore-court-garage
  shot settings $t $T -qaVisited -qaTab settings
  shot story $t $T -qaVisited -qaPct 30 -qaTab story
  shot layers $t $T -qaVisited -qaRoute layers
  shot route $t $T -qaRoute trip/port-gellhorn
  shot mypin $t $T -qaPin -qaZoom 640,540,3 -qaRoute pin/uqa
  [ -n "$QA_EMAIL" ] && shot account $t $T -qaVisited -qaTab settings -qaAPI http://localhost:8787 -qaLogin "$QA_EMAIL" "$QA_PASS"
done
# the landing page shows these
[ "$OUT" = docs/img/qa ] && for n in map place settings story; do for t in light dark; do cp "$OUT/ios-$n-$t.png" "web/img/ios-$n-$t.png"; done; done && echo "landing iOS screenshots updated"

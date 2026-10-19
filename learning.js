/* Learning state and scheduling; independent of rendering and browser storage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ToeicLearning = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // 2 minutes is a tunable product default, not a universal brain-science constant.
  var REPS = 3, DAY = 86400000, SHORT_GAP = 2*60000;
  function empty() { return {version:2, words:{}, days:{}, journey:{height:0,jumps:0,bestSession:0}, settings:{stage:1, unit:0, mode:'follow', dailyNew:5}}; }
  function dayKey(now) {
    return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  }
  function record(state, word) {
    return state.words[word] || {correct:0, mistakes:0, due:0, last:0, reviews:0, lastTurn:-100};
  }
  function load(raw, legacy) {
    var state = empty(), parsed;
    try { parsed = JSON.parse(raw || 'null'); } catch (_) { parsed = null; }
    if (parsed && parsed.version === 2) {
      if(parsed.journey && typeof parsed.journey==='object') {
        ['height','jumps','bestSession'].forEach(function(k){var value=parsed.journey[k];if(Number.isFinite(value)&&value>=0)state.journey[k]=Math.floor(value)});
      }
      if (parsed.words && typeof parsed.words === 'object') Object.keys(parsed.words).forEach(function(w) {
        var r = parsed.words[w];
        if (!r || typeof r !== 'object' || !Number.isFinite(r.correct)) return;
        state.words[w] = {correct:Math.max(0,Math.min(REPS,Math.floor(r.correct))),mistakes:Math.max(0,Number(r.mistakes)||0),due:Math.max(0,Number(r.due)||0),last:Math.max(0,Number(r.last)||0),reviews:Math.max(0,Number(r.reviews)||0),lastTurn:-100};
      });
      if (parsed.days && typeof parsed.days === 'object') Object.keys(parsed.days).forEach(function(d) {
        var row=parsed.days[d];
        if (row && Array.isArray(row.introduced)) state.days[d]={introduced:row.introduced.filter(function(w){return typeof w==='string'}),right:Number(row.right)||0,wrong:Number(row.wrong)||0};
      });
      if (parsed.settings) {
        state.settings.stage=Math.max(1,Math.min(5,Math.floor(Number(parsed.settings.stage)||1)));
        state.settings.unit=Math.max(0,Math.floor(Number(parsed.settings.unit)||0));
        state.settings.mode=['follow','recall','listen'].includes(parsed.settings.mode)?parsed.settings.mode:'follow';
        state.settings.dailyNew=Math.max(1,Math.min(20,Math.floor(Number(parsed.settings.dailyNew)||5)));
      }
      // Old versions counted repeat jumps as reviews. A first-day record is
      // unambiguous: no cross-day spaced review could have happened yet.
      var introducedOn=Object.create(null);
      Object.keys(state.days).sort().forEach(function(d){state.days[d].introduced.forEach(function(w){if(!introducedOn[w])introducedOn[w]=d})});
      Object.keys(state.words).forEach(function(w){var r=state.words[w];
        if(r.correct>=REPS&&r.reviews>0&&introducedOn[w]&&Number.isFinite(r.last)&&r.last>0&&introducedOn[w]===dayKey(r.last)){
          r.reviews=0;r.due=Math.min(r.due,r.last+DAY);
        }
      });
      return state;
    }
    try { parsed=JSON.parse(legacy || '{}'); } catch (_) { parsed={}; }
    if (parsed && typeof parsed==='object') Object.values(parsed).forEach(function(level) {
      if(!level || typeof level!=='object') return;
      Object.keys(level).forEach(function(w) { var n=Number(level[w]); if(Number.isFinite(n)&&n>0) state.words[w]={correct:Math.min(REPS,n),mistakes:0,due:0,last:1,reviews:0,lastTurn:-100}; });
    });
    return state;
  }
  function today(state, now) {
    var key=dayKey(now);
    if(!state.days[key]) state.days[key]={introduced:[],right:0,wrong:0};
    return state.days[key];
  }
  function answer(state, word, correct, now, turn, aided) {
    var previous=record(state,word),r=Object.assign({},previous),d=today(state,now);
    if(!previous.last && !d.introduced.includes(word)) d.introduced.push(word);
    r.last=now; r.lastTurn=turn;
    if(correct) {
      d.right++;
      // Two initial successes are followed by a real time gate. Extra copying
      // before that gate cannot turn short-term familiarity into mastery.
      if(previous.correct===2&&previous.due>now){state.words[word]=r;return r;}
      if(previous.correct>=REPS&&previous.due>now){state.words[word]=r;return r;}
      if(previous.correct>=2&&aided){r.correct=2;r.due=now+SHORT_GAP;state.words[word]=r;return r;}
      r.correct=Math.min(REPS,r.correct+1);
      // Practice before the due time must not inflate the spaced-review interval.
      var earlyMastered=previous.correct>=REPS&&previous.due>now;
      if(!earlyMastered){
        if(previous.correct>=REPS)r.reviews++;
        r.due=now+(r.correct<REPS?SHORT_GAP:Math.min(30,Math.pow(2,r.reviews))*DAY);
      }
    } else {
      r.correct=Math.max(0,r.correct-1); r.mistakes++; r.reviews=0; r.due=now+2*60000; d.wrong++;
    }
    state.words[word]=r;
    return r;
  }
  function unitWords(vocab, stage, unit) { return vocab.filter(function(w){return w.stage===stage}).slice(unit*20,(unit+1)*20); }
  function plan(state, vocab, stage, unit, now, reviewOnly, unlimited) {
    var d=today(state,now),local=unitWords(vocab,stage,unit);
    var due=vocab.filter(function(w){var r=record(state,w.w);return r.last>0&&r.due<=now}).sort(function(a,b){return record(state,a.w).due-record(state,b.w).due}).slice(0,5);
    var ongoing=local.filter(function(w){var r=record(state,w.w);return r.last>0&&r.correct<2});
    // Unlimited play uses small automatic batches, never the daily allowance.
    var room=unlimited?5:Math.max(0,state.settings.dailyNew-d.introduced.length);
    var fresh=reviewOnly?[]:local.filter(function(w){return !record(state,w.w).last}).slice(0,room);
    var pool=[].concat(due,ongoing,fresh),seen=new Set();
    pool=pool.filter(function(w){if(seen.has(w.w))return false;seen.add(w.w);return true});
    // Optional early practice is only for already-mastered words. Never break
    // the cooling period of a twice-practised word just to fill a platform.
    var fallback=!pool.length;
    if(fallback) pool=vocab.filter(function(w){return record(state,w.w).correct>=REPS}).sort(function(a,b){return record(state,a.w).due-record(state,b.w).due}).slice(0,10);
    var waiting=vocab.filter(function(w){var r=record(state,w.w);return r.correct===2&&r.due>now}).map(function(w){return record(state,w.w).due});
    return {pool:pool,newCount:fresh.length,dueCount:due.length,fallback:fallback,nextDue:waiting.length?Math.min.apply(null,waiting):0,waiting:waiting.length};
  }
  function pick(state,pool,turn,excluded,sessionHits,recent) {
    var spaced=pool.filter(function(w){return !(recent||[]).includes(w.w)});
    if(!spaced.length)spaced=pool.slice();
    var candidates=spaced.filter(function(w){return !excluded.includes(w.w)});
    if(!candidates.length) candidates=spaced;
    candidates.sort(function(a,b) {
      function priority(w){var r=record(state,w.w);return (r.correct>=2?-1000:0)+(turn-r.lastTurn<2?10000:0)+(sessionHits[w.w]||0)*100+r.correct*5-Math.min(r.mistakes,5);}
      return priority(a)-priority(b);
    });
    return candidates[0];
  }
  function stats(state, vocab, stage) {
    var list=stage?vocab.filter(function(w){return w.stage===stage}):vocab;
    return {total:list.length,learned:list.filter(function(w){return record(state,w.w).correct>=REPS}).length,hits:list.reduce(function(n,w){return n+record(state,w.w).correct},0)};
  }
  return {REPS:REPS,DAY:DAY,SHORT_GAP:SHORT_GAP,empty:empty,load:load,record:record,today:today,answer:answer,unitWords:unitWords,plan:plan,pick:pick,stats:stats,dayKey:dayKey};
});

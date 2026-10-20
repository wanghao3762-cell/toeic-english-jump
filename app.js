'use strict';
var L=window.ToeicLearning, A=window.ToeicAscent, VOCAB=window.TOEIC_VOCABULARY;
var STORE='toeic-learning-v2', state, storageWarning='';
var C=window.ToeicComfort,COMFORT_STORE='toeic-comfort-v1',comfort;
try{comfort=C.load(localStorage.getItem(COMFORT_STORE))}catch(e){comfort=C.load(null)}
try { state=L.load(localStorage.getItem(STORE),localStorage.getItem('toeic-jump-progress-v1')); }
catch(e) { state=L.empty(); storageWarning='浏览器无法保存进度，请允许本地存储后再长期学习。'; }
var LEVEL_META={
  1:{name:'A1 · 入门基础',desc:'基础高频词前 500，加星期、月份、数词补充；先打好基础。',score:'听力 60 / 阅读 60'},
  2:{name:'A2 · 日常基础',desc:'扩展常用词与日常表达，逐渐减少英文提示。',score:'听力 110 / 阅读 115'},
  3:{name:'B1 · 核心提升',desc:'补齐基础常用词，练习词义回忆和听音。',score:'听力 275 / 阅读 275'},
  4:{name:'B2 · 托业进阶',desc:'TSL 前 650，加 20 个商务形式补充，衔接职场场景。',score:'听力 400 / 阅读 385'},
  5:{name:'C1 · 高分拓展',desc:'补齐 TSL 词汇，并搭配听力与限时阅读。',score:'听力 490 / 阅读 455'}
};
var MAX_LV=5,LEARN_REPS=3,cv=document.getElementById('cv'),ctx=cv.getContext('2d'),CW=0,CH=0,DPR=1;
var STAKE_W=208,BODY_H=102,MAXJ=300,ROBOT_AT=.72,AHEAD=3;
// Tall windows must not turn every step into a long empty climb. The 152px floor
// keeps labels above the robot's head; the 184px ceiling keeps the route dense.
function stepGap(){return Math.max(152,Math.min(184,Math.round((CH||420)*.20)))}
var S={level:state.settings.stage,unit:state.settings.unit,stakes:[],cur:null,robot:{x:0,y:0},cam:0,pathX:0,typed:'',running:false,jump:null,landT:0,playTime:0,last:0,jumps:0,errs:0,combo:0,maxCombo:0,score:0,crits:0,alt:0,parts:[],texts:[],shake:0,hl:true,snd:false,pool:[],hits:{},turn:0,focus:null,revealed:false,feedback:'',pending:false,reviewStart:new Set(),mode:state.settings.mode};
S.baseAltitude=state.journey.height;S.startY=-S.baseAltitude/A.METERS_PER_PIXEL;S.milestoneT=0;S.osReduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);S.reduced=S.osReduced||comfort.prefs.calm;
S.sessionMode='daily';S.badChar='';S.composing=false;S.endRequested=false;S.batches=1;S.practicedWords=new Set();S.completedWords=new Set();
S.recent=[];S.aided=false;S.memoryOpen=false;S.memoryWord=null;S.memoryReveal=false;
S.aidedWords=new Set();
S.comfortOpen=false;S.restOpen=false;S.restRequested=false;
function el(id){return document.getElementById(id)}
function showStorageWarning(){el('storageNotice').textContent=storageWarning;el('storageNotice').hidden=!storageWarning}
function persist(){state.settings.stage=S.level;state.settings.unit=S.unit;state.settings.mode=S.mode;try{localStorage.setItem(STORE,JSON.stringify(state));localStorage.setItem(COMFORT_STORE,C.save(comfort));storageWarning=''}catch(e){storageWarning='进度或舒适偏好未能保存；请检查浏览器本地存储设置。'}showStorageWarning()}
function now(){return Date.now()}
function routeBounds(){return {left:CW>760?306:STAKE_W/2+15,right:CW-(CW>760?349:STAKE_W/2+15)}}
function clampX(x){var b=routeBounds();return Math.max(b.left,Math.min(b.right,x))}
function resize(){var r=cv.getBoundingClientRect(),w=Math.max(280,Math.round(r.width)),h=Math.max(200,Math.round(r.height));if(w===CW&&h===CH)return;var ratio=CW?w/CW:1;CW=w;CH=h;ROBOT_AT=h<360?.86:.72;AHEAD=Math.max(3,Math.ceil((CH*ROBOT_AT+100)/stepGap()));DPR=Math.min(window.devicePixelRatio||1,2);cv.width=CW*DPR;cv.height=CH*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);S.cam=S.robot.y-CH*ROBOT_AT;if(S.stakes.length){S.stakes.forEach(function(s){s.x=clampX(s.x*ratio)});S.robot.x=clampX(S.robot.x*ratio);S.pathX=clampX(S.pathX*ratio);if(S.jump){S.jump.fx=clampX(S.jump.fx*ratio);S.jump.tx=S.jump.target.x}if(w<620){var rows=new Set();S.stakes=[S.cur].concat(S.stakes.filter(function(s){return s!==S.cur})).filter(function(s){var key=String(s.y);if(rows.has(key)&&(!S.jump||s!==S.jump.target))return false;rows.add(key);return true})}if(S.trail)S.trail.forEach(function(p){p.x=clampX(p.x*ratio)})}}
window.addEventListener('resize',resize);if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(el('stage'));
function dist(a,b,c,d){return Math.hypot(a-c,b-d)}
function record(w){return L.record(state,w)}
function units(stage){return Math.ceil(VOCAB.filter(function(w){return w.stage===stage}).length/20)}
function localWords(){return L.unitWords(VOCAB,S.level,S.unit)}
// A block finishes after initial practice, not by forcing the delayed third hit.
function unitDone(){return localWords().every(function(w){return record(w.w).correct>=2})}
function finished(w){return record(w.w).correct>=2&&(!S.reviewStart.has(w.w)||(S.hits[w.w]||0)>0)}
function sessionDone(){return S.pool.length>0&&S.pool.every(finished)}
function upcomingWords(){
  if(S.sessionMode!=='endless')return [];
  // Forecast only: previewing scenery must never introduce a word, complete a
  // review, or change the real save. The actual batch is still committed on landing.
  var at=now(),key=[S.turn,S.batches,S.level,S.unit,Math.floor(at/1000)].join(':');
  if(S.previewCache&&S.previewCache.key===key)return S.previewCache.pool;
  var projected=JSON.parse(JSON.stringify(state)),stage=S.level,unit=S.unit;
  S.pool.forEach(function(w){var r=Object.assign({},L.record(projected,w.w));r.correct=Math.max(2,r.correct);r.last=r.last||at;r.due=Math.max(r.due,at+L.SHORT_GAP);projected.words[w.w]=r});
  while(L.unitWords(VOCAB,stage,unit).every(function(w){return L.record(projected,w.w).correct>=2})){
    if(unit+1<units(stage))unit++;else if(stage<MAX_LV){stage++;unit=0}else break;
  }
  var pool=L.plan(projected,VOCAB,stage,unit,at,false,true).pool.filter(function(w){return !S.pool.some(function(old){return old.w===w.w})});
  S.previewCache={key:key,pool:pool};return pool;
}
function pickWord(x,y){
  // Several islands are laid ahead at once, so the whole live map must stay word-unique:
  // excluding only the nearest one would put the same word on two steps at the same time.
  var blockSeed=S.jumps===0&&S.pool.length>1&&!S.stakes.some(function(s){return s!==S.cur&&s.y<S.cur.y});
  var placed=S.stakes.filter(function(s){return (s!==S.cur||blockSeed)&&s.state==='live'&&!s.solved}).map(function(s){return s.w.w});
  var pool=(S.pool.length?S.pool:localWords()).filter(function(w){return !finished(w)&&!placed.includes(w.w)});
  if(!pool.length)pool=upcomingWords().filter(function(w){return !placed.includes(w.w)});
  return L.pick(state,pool,S.turn,placed,S.hits,S.recent);
}
function addStake(x,y){
  var word=pickWord(x,y);if(!word)return;
  // Word is fixed when the island is built; the island itself never moves afterwards.
  var order=S.stakes.length?Math.max.apply(null,S.stakes.map(function(s){return s.order||0}))+1:1;
  var stake={x:x,y:y,w:word,lv:word.stage,state:'live',fall:0,bob:Math.random()*6.28,hintCorrect:record(word.w).correct,order:order,fontSize:C.font(comfort.prefs,order)};
  S.stakes.push(stake);return stake;
}
function genUp(){
  if(!S.running||S.jump||S.pending||!S.cur)return;
  // Borrowed from 汉字双拼跳一跳's 梅花桩: lay the next islands ahead of time and leave the
  // top one just beyond the top edge. The rising camera carries it down into the picture,
  // so a step never pops in mid-screen and never drops from the sky.
  var gap=stepGap();
  for(var guard=0;guard<AHEAD+2;guard++){
    var above=0,top=null;
    S.stakes.forEach(function(s){if(s.state!=='live')return;if(s.y<S.cur.y)above++;if(!top||s.y<top.y)top=s});
    if(above>=AHEAD)break;
    // Anchor the route on the island actually above, never on an accumulator: a drifting
    // path would sooner or later lay a step beyond MAXJ and trap the player.
    var from=top||S.cur;
    var bounds=routeBounds(),next=C.nextX(from.x,bounds.left,bounds.right,from.routeDir||1,comfort.prefs.route,gap);S.pathX=next.x;
    var stake=addStake(S.pathX,from.y-gap);
    if(!stake)break;
    stake.routeDir=next.direction;
    // The same word must never sit on two steps at once: if the words run short, lay one
    // island less instead of duplicating.
    if(above>0&&S.stakes.some(function(s){return s!==S.cur&&s!==stake&&s.state==='live'&&!s.solved&&s.w.w===stake.w.w})){S.stakes.pop();break}
  }
}
function stakeScreenY(stake){return stake.y-S.cam}

function reachable(){return S.stakes.filter(function(s){return s.state==='live'&&s!==S.cur&&!s.fall&&s.y<S.robot.y-22&&dist(S.robot.x,S.robot.y,s.x,s.y)<=MAXJ}).sort(function(a,b){return dist(S.robot.x,S.robot.y,a.x,a.y)-dist(S.robot.x,S.robot.y,b.x,b.y)})}
function chooseFocus(stake){if(!stake||S.jump||S.memoryOpen||comfortPaused())return;S.focus=stake;S.typed='';S.badChar='';S.revealed=false;S.aided=false;S.feedback='';renderInput();if(S.mode==='listen')speak()}
function currentFocus(){var targets=reachable();if(!targets.includes(S.focus)){S.focus=targets.find(function(s){return !finished(s.w)})||targets[0]||null;S.revealed=false;}return S.focus}
function targetRevealed(stake){return S.revealed&&(!stake||stake===S.focus||S.jump&&stake===S.jump.target)}
function shownWord(w,stake){var display=w.w==='i'?'I':w.w;if(stake&&stake.solved||targetRevealed(stake)||(!S.running&&!S.jump))return display;if(S.mode==='listen'||S.mode==='recall')return '•'.repeat(w.answer.replace(/[^a-z]/g,'').length);var n=stake&&Number.isFinite(stake.hintCorrect)?stake.hintCorrect:record(w.w).correct;if(n===0)return display;if(n===1)return display.slice(0,1)+'·'.repeat(Math.max(0,w.answer.length-1));return '•'.repeat(w.answer.length)}
function shownMeaning(w,stake){return S.running&&!targetRevealed(stake)&&(S.mode!=='follow'||record(w.w).correct>0)?window.ToeicMemory.masked(w.meaning,w.w):w.meaning}
function hasSpeech(){return 'speechSynthesis' in window&&'SpeechSynthesisUtterance' in window}
function speak(){var target=currentFocus();if(!target)return;if(!hasSpeech()){S.feedback='此浏览器不支持朗读，可使用跟打或回忆模式。';renderInput();return}window.speechSynthesis.cancel();var utterance=new SpeechSynthesisUtterance(target.w.w);utterance.lang='en-US';utterance.rate=.8;var voices=window.speechSynthesis.getVoices(),voice=voices.find(function(v){return /^en-US/i.test(v.lang)})||voices.find(function(v){return /^en/i.test(v.lang)});if(voice)utterance.voice=voice;utterance.onerror=function(){S.feedback='朗读不可用，请选择跟打或回忆模式。';renderInput()};window.speechSynthesis.speak(utterance)}
function startSession(reviewOnly,sessionMode){
  S.previewCache=null;
  S.sessionMode=sessionMode==='endless'?'endless':'daily';
  if(!reviewOnly){while(unitDone()){if(S.unit+1<units(S.level))S.unit++;else if(S.level<MAX_LV){S.level++;S.unit=0}else break;}}
  var plan=L.plan(state,VOCAB,S.level,S.unit,now(),!!reviewOnly,S.sessionMode==='endless');
  S.pool=plan.pool;S.hits={};S.turn=0;S.reviewStart=new Set(S.pool.filter(function(w){return record(w.w).correct>=2}).map(function(w){return w.w}));
  if(!S.pool.length){el('menuStatus').textContent=plan.nextDue?'初练已完成，'+Math.max(1,Math.ceil((plan.nextDue-now())/60000))+' 分钟后有词回顾；也可选无限模式继续新词。':'暂无旧词可复习，请先开始无限攀登。';return}
  S.baseAltitude=state.journey.height;S.startY=-S.baseAltitude/A.METERS_PER_PIXEL;
  S.stakes=[];S.robot={x:CW/2,y:S.startY};S.pathX=CW/2;S.cam=S.startY-CH*ROBOT_AT;
  S.cur={x:CW/2,y:S.startY,w:S.pool[0],lv:S.level,state:'live',fall:0,bob:0};S.stakes.push(S.cur);
  S.typed='';S.running=true;S.jump=null;S.landT=0;S.focus=null;S.revealed=false;S.feedback='';S.playTime=0;S.last=0;S.jumps=0;S.errs=0;S.combo=0;S.maxCombo=0;S.score=0;S.crits=0;S.alt=0;S.parts=[];S.texts=[];S.pending=false;
  S.badChar='';S.composing=false;S.endRequested=false;S.batches=1;S.practicedWords=new Set();S.completedWords=new Set();
  S.recent=[];S.aided=false;S.aidedWords=new Set();closeMemory(false);
  lastFrame=0;
  S.trail=[{x:S.robot.x,y:S.robot.y}];S.milestoneUntil=0;el('ascentMilestone').hidden=true;
  genUp();el('overlay').classList.add('hide');el('summary').classList.add('hide');persist();syncHud();syncAscent();renderInput();if(S.mode==='listen')speak();
}
function nextEndlessBatch(){
  S.pool.forEach(function(w){if(record(w.w).correct>=3)S.completedWords.add(w.w)});
  while(unitDone()){if(S.unit+1<units(S.level))S.unit++;else if(S.level<MAX_LV){S.level++;S.unit=0}else break;}
  var plan=L.plan(state,VOCAB,S.level,S.unit,now(),false,true);
  if(plan.fallback&&plan.pool.length){var known=VOCAB.filter(function(w){return record(w.w).correct>=3}).sort(function(a,b){return record(a.w).due-record(b.w).due}),offset=S.batches*10%known.length;plan.pool=known.slice(offset,offset+10).concat(known.slice(0,Math.max(0,offset+10-known.length))).slice(0,Math.min(10,known.length));}
  if(!plan.pool.length){showSummary();return}
  S.pool=plan.pool;S.hits={};S.reviewStart=new Set(S.pool.filter(function(w){return record(w.w).correct>=2}).map(function(w){return w.w}));
  S.batches++;S.pending=false;S.focus=null;S.revealed=false;S.badChar='';S.typed='';
  S.feedback='第 '+S.batches+' 组已接上 · 继续攀登，不限新词';genUp();persist();syncHud();renderInput();if(S.mode==='listen')speak();
}
function requestFinish(){if(!S.running)return;if(S.jump){S.endRequested=true;el('bFinish').disabled=true;S.feedback='本次落地后结算';renderInput()}else showSummary()}
function startJump(target){
  var d=dist(S.robot.x,S.robot.y,target.x,target.y),delta=S.last?(performance.now()-S.last)/1000:99,crit=delta<Math.max(1.2,target.w.answer.length*.16);
  var gain=(10+Math.min(S.combo,10))*(crit?2:1);S.score+=gain;S.combo++;S.maxCombo=Math.max(S.combo,S.maxCombo);S.jumps++;S.turn++;S.hits[target.w.w]=(S.hits[target.w.w]||0)+1;
  L.answer(state,target.w.w,true,now(),S.turn,S.aided||S.revealed||S.aidedWords.has(target.w.w));target.solved=true;S.aidedWords.delete(target.w.w);S.recent.push(target.w.w);S.recent=S.recent.slice(-2);persist();S.pending=sessionDone();
  if(crit){S.crits++;S.critT=1;}
  S.comboPop=1;
  S.landT=0;
  S.jump={fx:S.robot.x,fy:S.robot.y,tx:target.x,ty:target.y,t:0,dur:S.osReduced?300:Math.round(300+d*.3),arc:(S.osReduced?46:S.reduced?76:100)+Math.abs(target.y-S.robot.y)*.10,target:target};S.typed=target.w.answer;S.badChar='';S.feedback='正确！'+target.w.w+' · '+memoryStatus(target.w);syncHud();renderInput();beep(660,.07);
}
function onKey(ch){
  if(!S.running||S.jump||S.memoryOpen||comfortPaused())return;var target=currentFocus();if(!target)return;
  if(!/^[a-zA-Z '-]$/.test(ch)){S.feedback='请切换英文键盘，或点击下方字母键';renderInput();return}
  S.practicedWords.add(target.w.w);
  var answer=target.w.answer,buf=S.typed+ch.toLowerCase();
  if(answer.indexOf(buf)!==0){S.turn++;L.answer(state,target.w.w,false,now(),S.turn);persist();S.errs++;S.combo=0;S.shake=1;S.badChar=ch;S.revealed=true;S.feedback='再看一次：'+target.w.w+'（'+target.w.meaning+'）';flashKey(ch,true);beep(180,.1);syncHud();renderInput();return}
  flashKey(ch,false);S.typed=buf;S.badChar='';S.feedback='';if(buf===answer){startJump(target);return}renderInput();
}
function back(){if(!S.running||S.jump||S.memoryOpen||comfortPaused())return;if(S.badChar)S.badChar='';else S.typed=S.typed.slice(0,-1);S.feedback='';renderInput()}
function flashKey(ch,bad){var key=document.querySelector('.key[data-k="'+ch+'"]');if(key){key.classList.add(bad?'err':'hit');setTimeout(function(){key.classList.remove('err','hit')},180)}}
document.addEventListener('keydown',function(e){
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(comfortPaused()){if(e.key==='Escape'){e.preventDefault();if(S.restOpen)leaveRest(false);else closeComfort()}return}
  if(S.memoryOpen){if(e.key==='Escape'){e.preventDefault();closeMemory()}return}
  if(!S.running)return;
  if(e.isComposing||e.key==='Process'){S.feedback='请切换英文键盘，或点击下方字母键';renderInput();return}
  if(document.activeElement===el('typingCapture')&&e.key==='Escape'){e.preventDefault();S.typed='';S.badChar='';S.feedback='';renderInput();return}
  if(document.activeElement===el('typingCapture')&&e.key==='Tab'){e.preventDefault();if(!S.jump){var choices=reachable(),index=choices.indexOf(currentFocus());chooseFocus(choices[(index+1)%choices.length])}return}
  if(document.activeElement===el('typingCapture')&&e.key==='Backspace'&&S.badChar){e.preventDefault();back();return}
  if(['SELECT','INPUT','TEXTAREA'].includes(document.activeElement&&document.activeElement.tagName))return;
  if(e.key==='Backspace'){e.preventDefault();back()}else if(e.key==='Escape'){S.typed='';S.badChar='';renderInput()}else if(e.key==='Tab'){e.preventDefault();var r=reachable(),i=r.indexOf(S.focus);chooseFocus(r[(i+1)%r.length])}else if(e.key.length===1){e.preventDefault();onKey(e.key)}
});
function captureInput(){
  if(S.composing||!S.running||S.jump||S.memoryOpen||comfortPaused())return;
  var field=el('typingCapture'),value=field.value.toLowerCase();
  if(!/^[a-z '-]*$/.test(value)){S.feedback='请切换英文键盘，或点击下方字母键';renderInput();return}
  if(S.typed.indexOf(value)===0){S.typed=value;S.badChar='';S.feedback='';renderInput();return}
  var extra=value.indexOf(S.typed)===0?value.slice(S.typed.length):value;
  if(value.indexOf(S.typed)!==0)S.typed='';
  for(var i=0;i<extra.length&&!S.jump;i++){onKey(extra[i]);if(S.badChar)break;}
}
el('typingCapture').addEventListener('input',captureInput);
el('typingCapture').addEventListener('compositionstart',function(){S.composing=true;S.feedback='请切换英文键盘，或点击下方字母键';renderInput()});
el('typingCapture').addEventListener('compositionend',function(){S.composing=false;captureInput()});
cv.addEventListener('click',function(e){if(!S.running||S.jump)return;var r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;var target=reachable().find(function(s){var top=stakeScreenY(s);return Math.abs(s.x-x)<STAKE_W/2+10&&y>top-18&&y<top+BODY_H});if(target)chooseFocus(target)});
function buildKb(){var rows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];rows.forEach(function(row,index){var d=document.createElement('div');d.className='key-row';row.split('').forEach(function(c){var b=document.createElement('button');b.className='key';b.textContent=c;b.dataset.k=c.toLowerCase();b.onclick=function(){onKey(c)};d.appendChild(b)});if(index===2){[['空格',' '],['-','-'],["'","'"],['退格',null]].forEach(function(pair){var b=document.createElement('button');b.className='key wide';b.textContent=pair[0];b.onclick=function(){pair[1]===null?back():onKey(pair[1])};d.appendChild(b)})}el('kb').appendChild(d)})}
function memoryStatus(w){var r=record(w.w);if(r.correct===0)return '初识 · 0/3';if(r.correct===1)return '初练 · 1/2';if(r.correct===2)return r.due>now()?'初练 2/2 · 已进入间隔队列':'间隔回忆 · 第 3 次';return '本轮掌握 3/3 · '+(r.due<=now()?'到期复习':'之后跨天复习')}
function openMemory(){
  var target=currentFocus();if(!S.running||S.jump||!target||comfortPaused())return;
  S.memoryOpen=true;S.memoryWord=target.w;S.memoryReveal=S.revealed||(S.mode==='follow'&&record(target.w.w).correct===0);
  el('memoryDialog').hidden=false;renderMemory();renderInput();if(el('memoryClose').focus)el('memoryClose').focus();
}
function closeMemory(returnFocus){S.memoryOpen=false;S.memoryWord=null;el('memoryDialog').hidden=true;if(returnFocus!==false){renderInput();if(S.running&&el('typingCapture').focus)el('typingCapture').focus()}}
function renderMemory(){
  var w=S.memoryWord;if(!w)return;var target=currentFocus(),root=target&&target.w.w===w.w,hidden=!S.memoryReveal,m=w.memory;
  el('memoryTitle').textContent=hidden?'先回忆，再看联想':(w.w==='i'?'I':w.w)+(w.phonetic?' /'+w.phonetic+'/':'');
  el('memoryMeaning').textContent=S.mode==='listen'&&hidden?'听音目标，先尝试回忆':hidden?window.ToeicMemory.masked(w.meaning,w.w):w.meaning;
  el('memoryGate').hidden=!hidden;el('memoryGate').textContent='先尝试拼出英文。展开图文会提供答案线索；到期回忆中使用提示，将稍后再试，不直接算掌握。';
  el('memoryShow').hidden=!hidden;
  el('memoryFigure').hidden=hidden||!m;el('memoryArt').innerHTML=!hidden&&m?window.ToeicMemory.scene(m.scene):'';
  el('memoryCaption').textContent=m?window.ToeicMemory.titles[m.scene]+' · 共享情境示意，并非每词专用插画':'';
  el('memorySentence').textContent=m?(hidden?(S.mode==='listen'?'':window.ToeicMemory.masked(m.en,w.w)):m.en):'';
  el('memoryTranslation').textContent=m&&!hidden?m.zh:'';
  el('memoryChunk').hidden=hidden||!m;el('memoryChunk').textContent=m&&!hidden?m.chunk:'';
  el('memoryDefinition').textContent=!m&&!hidden?(w.definition||'暂无英文释义'):'';
  el('memoryRelated').replaceChildren();
  if(m&&!hidden)m.related.forEach(function(key){var linked=VOCAB.find(function(word){return word.w===key});if(!linked)return;var button=document.createElement('button');button.textContent=key+' · '+linked.meaning.slice(0,18);button.onclick=function(){S.memoryWord=linked;renderMemory()};el('memoryRelated').appendChild(button)});
  el('memoryBack').hidden=root;el('memoryNote').textContent=m?'看一眼场景 → 读短句 → 想象自己在其中 → 收起后试着回忆。关联词只供浏览，不会自动增加学习任务。':'词典卡：此词尚未编写专用例句、搭配或情境图，暂不展示无关图片。可先结合英文释义回忆。';
  el('memoryCoverage').textContent='图文联想 '+VOCAB.filter(function(word){return !!word.memory}).length+' / '+VOCAB.length+' 词 · 原创教学短句，非 ETS 真题 · 浏览联想时攀登暂停';
}
el('bMemory').onclick=openMemory;el('memoryClose').onclick=function(){closeMemory()};
el('memoryShow').onclick=function(){S.memoryReveal=true;S.aided=true;S.revealed=true;var target=currentFocus();if(target)S.aidedWords.add(target.w.w);renderMemory();renderInput()};
el('memoryBack').onclick=function(){var target=currentFocus();if(target){S.memoryWord=target.w;renderMemory()}};
el('memoryDialog').addEventListener('click',function(e){if(e.target===el('memoryDialog'))closeMemory()});
el('memoryDialog').addEventListener('keydown',function(e){if(e.key==='Tab'){var buttons=el('memoryDialog').querySelectorAll?Array.from(el('memoryDialog').querySelectorAll('button')).filter(function(b){return !b.hidden&&b.getClientRects().length}):[];if(!buttons.length)return;var index=buttons.indexOf(document.activeElement);if(e.shiftKey&&index<=0){e.preventDefault();buttons[buttons.length-1].focus()}else if(!e.shiftKey&&index===buttons.length-1){e.preventDefault();buttons[0].focus()}}});
function renderInput(){
  var target=S.jump?S.jump.target:currentFocus(),box=el('inputTrack'),field=el('typingCapture');
  box.replaceChildren();
  var answer=target?target.w.answer:'',status='idle';
  if(!S.running){el('inputStatus').textContent=S.jumps?'本次已结束':'选择模式后开始输入';}
  else if(S.jump){status='success';el('inputStatus').textContent='拼写正确 · 正在起跳';}
  else if(S.composing||S.feedback.indexOf('请切换')===0){status='error';el('inputStatus').textContent='请切换英文键盘';}
  else if(S.badChar){status='error';el('inputStatus').textContent='这一位不对，换个字母试试';}
  else if(S.typed){status='typing';el('inputStatus').textContent='正在输入 · 继续拼完整词';}
  else{el('inputStatus').textContent='准备输入 · 英文键盘 / 下方字母键';}
  el('typingPanel').className='typing-panel '+status;
  el('inputCount').textContent=(S.typed.length)+' / '+answer.length;
  el('inputProgress').style.width=(answer.length?Math.min(100,S.typed.length/answer.length*100):0)+'%';
  if(!target){var p=document.createElement('span');p.className='placeholder';p.textContent='点击“开始无限攀登”，想学多久就学多久';box.appendChild(p);}
  else for(var i=0;i<answer.length;i++){
    var p=document.createElement('span'),done=i<S.typed.length;
    p.className='typed-char'+(done?' matched':' remaining')+(!S.jump&&i===S.typed.length?' current':'');
    var c=done?S.typed[i]:(S.revealed||(S.mode==='follow'&&(Number.isFinite(target.hintCorrect)?target.hintCorrect:record(target.w.w).correct)===0)?answer[i]:'·');
    p.textContent=c===' '?'␣':c;box.appendChild(p);
  }
  if(S.badChar){var bad=document.createElement('span');bad.className='typed-char bad';bad.textContent=S.badChar;box.children[S.typed.length]?box.insertBefore(bad,box.children[S.typed.length]):box.appendChild(bad);}
  box.scrollLeft=Math.max(0,S.typed.length*30-(box.clientWidth||300)*.55);
  if(!S.composing&&field.value!==S.typed)field.value=S.typed;
  field.readOnly=!S.running||!!S.jump||S.memoryOpen||comfortPaused();
  field.title=S.running?'直接输入英文；也可点击下方字母键':'请先开始一种学习模式';
  el('bHint').textContent=S.revealed?'收起答案':'显示答案';el('bHint').ariaPressed=String(S.revealed);
  el('bHint').disabled=!S.running||!target;el('bSpeak').disabled=!S.running||!target;el('bReveal').disabled=!S.running||!target;
  el('inputTip').className='input-tip'+(status==='error'?' bad':'');el('inputTip').textContent=S.feedback||(S.running?'输入完整单词即起跳 · Tab 切换目标':'无限模式不限新词，每日计划按建议量学习');
  var selector=el('targetSelect');selector.replaceChildren();reachable().forEach(function(s,i){var o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+'. '+(S.mode==='listen'&&!S.revealed?'听音目标':shownMeaning(s.w).slice(0,24));selector.appendChild(o);if(s===target)selector.value=String(i)});
  el('bMemory').disabled=!S.running||!target||!!S.jump;
  if(target){el('promptMeaning').textContent=S.mode==='listen'&&!S.revealed?'听发音，拼出英文单词':shownMeaning(target.w);el('promptMeaning').title=el('promptMeaning').textContent;el('promptExample').textContent=(target.w.phonetic&&S.mode!=='listen'?' /'+target.w.phonetic+'/ · ':'')+memoryStatus(target.w)+' · '+target.w.source+(target.w.rank?' #'+target.w.rank:' 补充词');el('promptFull').textContent=target.w.definition||'';}
  else{el('promptMeaning').textContent='拼一个词，向上一步';el('promptMeaning').title='';el('promptExample').textContent='初练两次，隔一会再回忆；第三次才计入掌握';el('promptFull').textContent='';}
}
function renderLevels(){
  var box=el('levels');box.replaceChildren();for(var i=1;i<=MAX_LV;i++)(function(stage){var info=L.stats(state,VOCAB,stage),b=document.createElement('button');b.className='level-choice'+(S.level===stage?' selected':'');var title=document.createElement('b');title.textContent=LEVEL_META[stage].name;var small=document.createElement('small');small.textContent=info.learned+'/'+info.total+' 词';b.append(title,small);b.onclick=function(){S.level=stage;S.unit=0;persist();renderLevels();renderUnits();syncHud()};box.appendChild(b)})(i);
}
function renderUnits(){var sel=el('unitSelect');sel.replaceChildren();for(var i=0;i<units(S.level);i++){var ws=L.unitWords(VOCAB,S.level,i),learned=ws.filter(function(w){return record(w.w).correct>=3}).length,o=document.createElement('option');o.value=String(i);o.textContent='第 '+(i+1)+' 单元 · '+learned+'/'+ws.length+' 词';sel.appendChild(o)}S.unit=Math.min(S.unit,units(S.level)-1);sel.value=String(S.unit);el('modeSelect').value=S.mode;var today=L.today(state,now()),due=VOCAB.filter(function(w){var r=record(w.w);return r.last&&r.due<=now()}).length;el('menuStatus').textContent=storageWarning||('今日已练新词 '+today.introduced.length+' · 到期复习 '+due+' 词 · 无限模式不设每日上限');el('menuLevelNote').textContent=LEVEL_META[S.level].desc+' 考试目标参考：'+LEVEL_META[S.level].score+'。'}
function syncHud(){
  var st=L.stats(state,VOCAB,S.level);el('sLv').textContent=['','A1','A2','B1','B2','C1'][S.level];el('sScore').textContent=S.score;el('sJump').textContent=S.jumps;el('sCombo').textContent=S.combo;el('sAcc').textContent=(S.jumps+S.errs?Math.round(S.jumps/(S.jumps+S.errs)*100):100)+'%';el('sProg').textContent=st.learned+'/'+st.total;el('routeName').textContent=LEVEL_META[S.level].name;
  var complete=S.pool.filter(finished).length;el('routeDesc').textContent=S.running?(S.sessionMode==='endless'?'无限 · 第 '+S.batches+' 组 · 已完成 '+S.completedWords.size+' 词 · 本组 '+complete+'/'+S.pool.length:'每日计划 · 本次完成 '+complete+'/'+S.pool.length+' 词'):LEVEL_META[S.level].desc;
  el('routeBar').style.width=(st.total?st.learned/st.total*100:0)+'%';el('bFinish').hidden=!S.running||S.sessionMode!=='endless';el('bFinish').disabled=S.endRequested;
}
function fmt(sec){return Math.floor(sec/60)+':'+String(Math.floor(sec%60)).padStart(2,'0')}
function ascentView(){
  var height=S.baseAltitude+S.alt;
  if(S.jump){var j=S.jump,t=Math.max(0,Math.min(1,j.t));height=S.baseAltitude+(S.startY-(j.fy+(j.ty-j.fy)*t))*A.METERS_PER_PIXEL;}
  return {w:CW,h:CH,cam:S.cam,altitude:Math.max(0,height),reduced:S.reduced,anchor:ROBOT_AT};
}
function syncAscent(){
  var altitude=Math.floor(ascentView().altitude),info=A.info(altitude);
  function text(id,value){var target=el(id);if(target.textContent!==String(value))target.textContent=String(value)}
  text('altHeight',altitude.toLocaleString('en-US'));text('altZone',info.current.name);text('altSession','本次 +'+Math.max(0,altitude-S.baseAltitude)+' 米');text('altNext','下站 '+info.next.height.toLocaleString('en-US')+' 米');
  el('altBar').style.width=(info.progress*100).toFixed(1)+'%';
  el('comboStat').className='stat'+(S.combo>=2?' combo-active':'');el('comboLabel').textContent=S.critT>0?'快打加成':'连击';
  if(S.milestoneUntil&&performance.now()>=S.milestoneUntil){el('ascentMilestone').hidden=true;S.milestoneUntil=0;}
}
function recordLanding(target){
  var before=state.journey.height;
  S.alt=Math.max(0,Math.round((S.startY-target.y)*A.METERS_PER_PIXEL));
  state.journey.height=S.baseAltitude+S.alt;state.journey.jumps++;state.journey.bestSession=Math.max(state.journey.bestSession,S.alt);
  S.trail=S.trail||[];S.trail.push({x:target.x,y:target.y});if(S.trail.length>12)S.trail.shift();
  var milestone=A.crossed(before,state.journey.height);
  if(milestone){el('milestoneTitle').textContent=milestone.height.toLocaleString('en-US')+' 米 · '+milestone.name;el('milestoneMessage').textContent=milestone.message;el('ascentMilestone').hidden=false;S.milestoneUntil=performance.now()+4200;}
  persist();syncAscent();
}
function drawTrail(){
  var points=S.trail||[];ctx.save();ctx.strokeStyle='rgba(255,249,238,.52)';ctx.lineWidth=2;ctx.setLineDash([3,9]);ctx.beginPath();
  points.forEach(function(p,i){if(i===0)ctx.moveTo(p.x,p.y-S.cam);else ctx.lineTo(p.x,p.y-S.cam)});ctx.stroke();
  if(S.focus&&!S.jump){var targetY=stakeScreenY(S.focus);ctx.strokeStyle='rgba(50,103,94,.35)';ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(S.robot.x,S.robot.y-S.cam-8);ctx.quadraticCurveTo(S.robot.x-30,(S.robot.y-S.cam+targetY)/2,S.focus.x,targetY-12);ctx.stroke();}
  ctx.restore();
}
function showSummary(){
  S.running=false;S.endRequested=false;if(hasSpeech())window.speechSynthesis.cancel();
  el('sumTitle').textContent=S.sessionMode==='endless'?'这次，又向上了一点':'本次学习完成';
  var waiting=VOCAB.filter(function(w){var r=record(w.w);return r.correct===2&&r.due>now()}).length;
  el('sumSub').textContent=(S.sessionMode==='endless'?'无限攀登 · 练习 '+S.practicedWords.size+' 词 · 本轮掌握 '+S.completedWords.size+' 词':'已完成 '+S.pool.length+' 词本次练习')+'。'+(waiting?'有 '+waiting+' 词进入间隔队列，约 2 分钟后再回忆，不用现在连续刷第三遍。':'之后仍会安排跨天复习。');
  el('sumStats').replaceChildren();[[S.sessionMode==='endless'?S.practicedWords.size:S.pool.length,'练习词数'],[S.jumps,'正确拼写'],[S.maxCombo,'最高连击'],[S.jumps+S.errs?Math.round(S.jumps/(S.jumps+S.errs)*100)+'%':'100%','准确率'],[fmt(S.playTime),'学习用时'],[S.score,'游戏积分'],[Math.round(S.alt)+' 米','本次攀登'],[state.journey.height.toLocaleString('en-US')+' 米','累计足迹']].forEach(function(item){var d=document.createElement('div'),b=document.createElement('b'),label=document.createElement('span');b.textContent=item[0];label.textContent=item[1];d.append(b,label);el('sumStats').appendChild(d)});
  el('sumNext').textContent=S.sessionMode==='endless'?'继续无限攀登':unitDone()?'进入下一单元':'继续学习';el('summary').classList.remove('hide');el('sumCard').scrollTop=0;syncHud();renderInput();persist();
}
function addText(x,y,t,c){S.texts.push({x:x,y:y,t:t,c:c,life:1})}
var AC=null;function beep(f,dur){if(!S.snd)return;try{if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();var o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;g.gain.setValueAtTime(.08,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+dur);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+dur)}catch(e){S.snd=false;el('bSound').textContent='音效不可用'}}
function update(dt,elapsed){
  if(S.memoryOpen||comfortPaused())return;
  var elapsedSeconds=elapsed===undefined?dt:Math.max(0,elapsed);
  S.landT=Math.max(0,S.landT-elapsedSeconds);
  S.playTime+=elapsed===undefined?dt:elapsed;S.comboPop=Math.max(0,(S.comboPop||0)-dt*3);S.critT=Math.max(0,(S.critT||0)-dt*1.4);
  if(S.jump){var j=S.jump;j.t+=elapsedSeconds*1000/j.dur;if(j.t>=1){
    S.cur=j.target;S.robot.x=j.tx;S.robot.y=j.ty;S.jump=null;recordLanding(j.target);
    if(record(j.target.w.w).correct>=3)S.completedWords.add(j.target.w.w);
    S.focus=null;S.revealed=false;S.aided=false;S.typed='';S.badChar='';S.last=performance.now();S.landT=.16;
    if(S.endRequested)showSummary();
    else if(S.pending){S.pending=false;if(S.sessionMode==='endless')nextEndlessBatch();else showSummary();}
    else{genUp();syncHud();renderInput();if(S.mode==='listen')speak();}
  }else{var pose=jumpPosition(j,j.t);S.robot.x=pose.x;S.robot.y=pose.y}}
  // Follow the rising support line, never the robot's up/down ballistic arc.
  var cameraY=S.robot.y;
  if(S.jump){var progress=Math.max(0,Math.min(1,S.jump.t)),ease=progress*progress*(3-2*progress);cameraY=S.jump.fy+(S.jump.ty-S.jump.fy)*ease;}
  S.cam+=((cameraY-CH*ROBOT_AT)-S.cam)*(1-Math.exp(-14*elapsedSeconds));
  genUp();S.stakes=S.stakes.filter(function(s){return s.y<S.cam+CH+200||s===S.cur});
  S.parts=S.parts.filter(function(p){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;return p.life>0});S.texts=S.texts.filter(function(t){t.y-=35*dt;t.life-=dt;return t.life>0});S.shake=Math.max(0,S.shake-dt*4);
}
function jumpPosition(j,t){t=Math.max(0,Math.min(1,t));return {x:j.fx+(j.tx-j.fx)*t,y:j.fy+(j.ty-j.fy)*t-4*j.arc*t*(1-t)}}

// Canvas art is retained from the reference-inspired prototype below.
function cloud(x,y,s,a){ctx.save();ctx.globalAlpha=a;ctx.fillStyle='#FFF9EE';ctx.beginPath();ctx.arc(x,y,24*s,0,Math.PI*2);ctx.arc(x+28*s,y-10*s,32*s,0,Math.PI*2);ctx.arc(x+65*s,y,23*s,0,Math.PI*2);ctx.moveTo(x-30*s,y+10*s);ctx.lineTo(x+94*s,y+10*s);ctx.quadraticCurveTo(x+104*s,y+10*s,x+104*s,y+21*s);ctx.quadraticCurveTo(x+104*s,y+31*s,x+91*s,y+31*s);ctx.lineTo(x-23*s,y+31*s);ctx.quadraticCurveTo(x-35*s,y+31*s,x-35*s,y+20*s);ctx.quadraticCurveTo(x-35*s,y+10*s,x-30*s,y+10*s);ctx.fill();ctx.restore()}
function drawBackground(t){A.drawBackground(ctx,ascentView(),S.reduced?0:t)}
function drawStake(s){
  var y=stakeScreenY(s);if(y<-160||y>CH+140)return;
  var cur=s===S.cur,active=s===S.focus&&!cur,broken=s.state==='broken',x=s.x,w=STAKE_W/2;
  ctx.save();if(broken)ctx.globalAlpha=.52;
  ctx.fillStyle='rgba(42,72,52,.10)';ctx.beginPath();ctx.ellipse(x,y+BODY_H+13,52,7,0,0,Math.PI*2);ctx.fill();
  var stone=ctx.createLinearGradient(0,y,0,y+BODY_H+18);stone.addColorStop(0,'#8B9F7B');stone.addColorStop(1,'#536B58');ctx.fillStyle=stone;
  ctx.beginPath();ctx.moveTo(x-w+3,y);ctx.lineTo(x-w+9,y+68);ctx.lineTo(x-36,y+99);ctx.lineTo(x-7,y+119);ctx.lineTo(x+13,y+102);ctx.lineTo(x+45,y+94);ctx.lineTo(x+w-6,y+61);ctx.lineTo(x+w-3,y);ctx.closePath();ctx.fill();
  ctx.fillStyle='#6B8367';ctx.beginPath();ctx.moveTo(x-12,y+4);ctx.lineTo(x-7,y+119);ctx.lineTo(x+13,y+102);ctx.lineTo(x+45,y+94);ctx.lineTo(x+31,y+39);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(238,239,212,.27)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-52,y+72);ctx.lineTo(x-35,y+87);ctx.moveTo(x+35,y+89);ctx.lineTo(x+49,y+67);ctx.stroke();
  ctx.fillStyle='#ABC587';ctx.beginPath();ctx.ellipse(x,y,w+3,12,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#D4DDA5';ctx.beginPath();ctx.ellipse(x-6,y-3,w-8,6,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#527A50';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-54,y-2);ctx.lineTo(x-57,y-12);ctx.moveTo(x-54,y-2);ctx.lineTo(x-49,y-10);ctx.moveTo(x+51,y-1);ctx.quadraticCurveTo(x+57,y-12,x+52,y-18);ctx.stroke();
  ctx.fillStyle='#749557';ctx.beginPath();ctx.ellipse(x+48,y-14,6,3,.6,0,Math.PI*2);ctx.ellipse(x+57,y-10,5,2,-.6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FFF7D9';ctx.beginPath();ctx.arc(x-56,y-13,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#D9A14F';ctx.beginPath();ctx.arc(x-56,y-13,1.5,0,Math.PI*2);ctx.fill();
  // Field-note labels stay opaque and readable against the scenery.
  ctx.shadowColor='rgba(33,59,43,.12)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;ctx.fillStyle=active?'#FFFBEA':'#F7F4E8';ctx.strokeStyle=active?'#CC8650':'#D8DDC7';ctx.lineWidth=active?2:1;
  ctx.beginPath();ctx.roundRect(x-w+7,y+16,STAKE_W-14,96,10);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.fillStyle=active?'#D99158':'#A1B699';ctx.beginPath();ctx.roundRect(x-12,y+13,24,5,2);ctx.fill();
  var label=shownWord(s.w,s);if(active&&S.typed&&!S.jump)label=(s.w.w==='i'?'I':S.typed)+label.slice(S.typed.length);
  var fontSize=s.fontSize||C.font(comfort.prefs,s.order),lines;
  do{ctx.font='700 '+fontSize+'px "Trebuchet MS",sans-serif';lines=C.wrap(label,STAKE_W-30,function(text){return ctx.measureText(text).width});if(lines.length<=2||fontSize<=20)break;fontSize--}while(true);
  ctx.textAlign='center';
  lines.forEach(function(line,index){
    var baseline=y+(lines.length>1?38:48)+index*(fontSize+1),fullWidth=ctx.measureText(line.text).width,left=x-fullWidth/2,matched=Math.max(0,Math.min(line.text.length,S.typed.length-line.start)),matchedWidth=ctx.measureText(line.text.slice(0,matched)).width;
    ctx.fillStyle='#28473B';ctx.fillText(line.text,x,baseline,STAKE_W-30);
    if(active&&!S.jump){
      if(matched){ctx.save();ctx.beginPath();ctx.rect(left-1,baseline-fontSize,matchedWidth+1,fontSize+4);ctx.clip();ctx.fillStyle='#2F7B47';ctx.fillText(line.text,x,baseline,STAKE_W-30);ctx.restore()}
      if(S.typed.length>=line.start&&S.typed.length<line.start+line.text.length&&(S.reduced||Math.floor(performance.now()/500)%2===0)){ctx.strokeStyle=S.badChar?'#BE6A51':'#5F8C54';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left+matchedWidth,baseline+4);ctx.lineTo(Math.min(left+matchedWidth+10,left+fullWidth),baseline+4);ctx.stroke()}
    }
  });
  ctx.fillStyle='#456454';ctx.font='13px "Microsoft YaHei",sans-serif';var meaning=S.mode==='listen'&&!targetRevealed(s)?'听音拼写':shownMeaning(s.w,s);while(ctx.measureText(meaning).width>STAKE_W-26&&meaning.length>2)meaning=meaning.slice(0,-2)+'…';ctx.fillText(meaning,x,y+(lines.length>1?92:76));
  var reps=record(s.w.w).correct;for(var i=0;i<3;i++){ctx.fillStyle=i<reps?'#528365':'#DCE3D0';ctx.beginPath();ctx.arc(x+(i-1)*12,y+103,3,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}
function drawRobot(){
  var x=S.robot.x,y=S.robot.y-S.cam,jumping=!!S.jump;ctx.save();ctx.translate(x,y);
  if(!S.osReduced&&!jumping&&S.landT>0){var squash=Math.sin(Math.PI*(1-S.landT/.16));ctx.scale(1+squash*.05,1-squash*.08)}
  if(!jumping){ctx.fillStyle='rgba(33,63,43,.16)';ctx.beginPath();ctx.ellipse(0,3,23,5,0,0,Math.PI*2);ctx.fill()}
  ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#365A49';ctx.lineWidth=2;
  ctx.fillStyle='#C7985F';ctx.beginPath();ctx.roundRect(13,-52,17,32,6);ctx.fill();ctx.stroke();ctx.fillStyle='#D8BF8B';ctx.beginPath();ctx.roundRect(13,-58,20,9,4);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#496851';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-9,-16);ctx.lineTo(jumping?-14:-10,-3);ctx.moveTo(9,-16);ctx.lineTo(jumping?15:10,-3);ctx.stroke();
  ctx.fillStyle='#3E6050';ctx.beginPath();ctx.roundRect(jumping?-21:-18,-6,15,7,3);ctx.roundRect(jumping?8:4,-6,15,7,3);ctx.fill();
  ctx.fillStyle='#E4E9D0';ctx.strokeStyle='#365A49';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-16,-43,32,28,9);ctx.fill();ctx.stroke();ctx.fillStyle='#A6BFA0';ctx.fillRect(-9,-29,18,6);
  ctx.strokeStyle='#365A49';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-18,-36);ctx.lineTo(jumping?-29:-25,jumping?-51:-23);ctx.moveTo(18,-36);ctx.lineTo(jumping?29:25,jumping?-47:-23);ctx.stroke();
  ctx.fillStyle='#D88457';ctx.beginPath();ctx.moveTo(10,-45);ctx.quadraticCurveTo(25,-48,32,-39);ctx.lineTo(28,-33);ctx.lineTo(15,-38);ctx.closePath();ctx.fill();
  ctx.fillStyle='#F6F3DE';ctx.strokeStyle='#365A49';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-25,-73,50,36,13);ctx.fill();ctx.stroke();
  ctx.fillStyle='#A7C9B3';ctx.beginPath();ctx.roundRect(-18,-64,36,20,8);ctx.fill();
  ctx.fillStyle='#294D40';ctx.beginPath();ctx.ellipse(-9,-55,3,4,0,0,Math.PI*2);ctx.ellipse(9,-55,3,4,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#426B53';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-53,5,.25,Math.PI-.25);ctx.stroke();
  ctx.fillStyle='#E7A27D';ctx.beginPath();ctx.ellipse(-15,-48,3,1.5,0,0,Math.PI*2);ctx.ellipse(15,-48,3,1.5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#D88457';ctx.beginPath();ctx.roundRect(-19,-42,38,7,3);ctx.fill();
  ctx.strokeStyle='#365A49';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-73);ctx.lineTo(0,-79);ctx.stroke();ctx.fillStyle='#B0CA89';ctx.beginPath();ctx.ellipse(5,-81,7,3,-.4,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawForeground(t){A.drawForeground(ctx,ascentView(),S.reduced?0:t)}
function drawFx(){/* Scoring feedback lives in the HUD so word labels stay unobstructed. */}
function draw(){var t=performance.now()/1000;drawBackground(t);ctx.save();if(S.shake&&!S.reduced)ctx.translate((Math.random()-.5)*7*S.shake,(Math.random()-.5)*7*S.shake);drawTrail();S.stakes.slice().sort(function(a,b){return a.y-b.y}).forEach(drawStake);drawRobot();S.parts.forEach(function(p){ctx.globalAlpha=Math.max(0,p.life*1.5);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y-S.cam,p.r,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;S.texts.forEach(function(q){ctx.globalAlpha=Math.max(0,q.life);ctx.fillStyle=q.c;ctx.font='700 15px "Trebuchet MS",sans-serif';ctx.textAlign='center';ctx.fillText(q.t,q.x,q.y-S.cam)});ctx.globalAlpha=1;drawForeground(t);ctx.restore();drawFx()}

function comfortPaused(){return S.comfortOpen||S.restOpen}
function comfortInert(){['hud','stage','workbench','memoryDialog'].forEach(function(id){el(id).inert=comfortPaused()})}
function applyComfort(){
  S.reduced=S.osReduced||comfort.prefs.calm;el('app').dataset.wordSize=comfort.prefs.size;
  if(S.reduced)el('app').classList.add('quiet');else el('app').classList.remove('quiet');
  S.stakes.forEach(function(s){s.fontSize=C.font(comfort.prefs,s.order||0)});
}
function focusAfterComfort(){renderInput();var target=S.running?el('typingCapture'):S.comfortReturn;if(target&&target.focus)target.focus()}
function openComfort(){
  if(S.restOpen)return;S.comfortReturn=document.activeElement;closeMemory(false);S.comfortOpen=true;
  el('comfortRoute').value=comfort.prefs.route;el('comfortSize').value=comfort.prefs.size;el('comfortMinutes').value=String(comfort.prefs.minutes);el('comfortVaried').checked=comfort.prefs.varied;el('comfortCalm').checked=comfort.prefs.calm;
  el('comfortDialog').hidden=false;comfortInert();renderInput();if(el('comfortClose').focus)el('comfortClose').focus();
}
function closeComfort(){
  comfort.prefs.route=el('comfortRoute').value==='center'?'center':'switchback';comfort.prefs.size=['normal','large','larger'].includes(el('comfortSize').value)?el('comfortSize').value:'large';comfort.prefs.minutes=[0,10,20,30].includes(Number(el('comfortMinutes').value))?Number(el('comfortMinutes').value):20;
  comfort.prefs.varied=!!el('comfortVaried').checked;comfort.prefs.calm=!!el('comfortCalm').checked;
  S.comfortOpen=false;el('comfortDialog').hidden=true;applyComfort();comfortInert();persist();focusAfterComfort();syncComfort();
}
function requestRest(){
  if(S.restOpen)return;
  if(S.comfortOpen)closeComfort();
  if(S.jump){S.restRequested=true;S.feedback='这一步落地后，离屏休息 20 秒';renderInput();return}
  beginRest();
}
function beginRest(){
  S.comfortReturn=document.activeElement;closeMemory(false);S.restOpen=true;S.restRequested=false;C.begin(comfort,now());
  if(hasSpeech())window.speechSynthesis.cancel();el('restDialog').hidden=false;comfortInert();renderInput();syncComfort();persist();if(el('restLater').focus)el('restLater').focus();
}
function leaveRest(completed){
  if(completed&&!C.finish(comfort,now()))return;
  if(!completed)C.postpone(comfort);
  S.restOpen=false;el('restDialog').hidden=true;lastFrame=0;comfortInert();persist();focusAfterComfort();syncComfort();
}
function tickComfort(elapsed){
  if(S.running&&!S.restOpen&&!document.hidden)C.advance(comfort,elapsed*1000);
  // Do not steal the word in progress, an IME composition, a memory card, or an airborne jump.
  if(!S.restOpen&&!S.comfortOpen&&!S.memoryOpen&&!S.jump&&!S.composing&&(S.restRequested||(S.running&&!S.typed&&!S.badChar&&C.due(comfort))))beginRest();
  syncComfort();
}
function syncComfort(){
  var status=comfort.prefs.minutes?'远眺提醒 '+fmt(Math.ceil(C.remaining(comfort)/1000)):'远眺提醒已关闭';
  if(C.due(comfort))status='本词结束后，离屏远眺';
  if(el('comfortStatus').textContent!==status)el('comfortStatus').textContent=status;
  if(S.restOpen){
    var left=Math.ceil(C.restLeft(comfort,now())/1000),message=left?'请把目光移开，不必盯着倒计时。':'20 秒已到；感觉舒适后再继续。';
    if(el('restSeconds').textContent!==String(left))el('restSeconds').textContent=String(left);
    if(el('restStatus').textContent!==message)el('restStatus').textContent=message;
    el('restContinue').disabled=left>0;el('restContinue').textContent=left?'休息中…':'休息好了，继续';
    el('restLater').textContent=comfort.prefs.minutes?'稍后 5 分钟提醒 · Esc':'跳过休息，返回 · Esc';
  }
}
function trapComfortFocus(dialog,e){
  if(e.key!=='Tab'||!dialog.querySelectorAll)return;
  var controls=Array.from(dialog.querySelectorAll('button,select,input,a[href]')).filter(function(b){return !b.disabled&&!b.hidden&&b.getClientRects().length});
  var index=controls.indexOf(document.activeElement);if(e.shiftKey&&index<=0){e.preventDefault();controls[controls.length-1].focus()}else if(!e.shiftKey&&index===controls.length-1){e.preventDefault();controls[0].focus()}
}
el('bComfort').onclick=openComfort;el('bMenuComfort').onclick=openComfort;el('bRest').onclick=requestRest;el('comfortRest').onclick=requestRest;
el('comfortClose').onclick=closeComfort;el('comfortSave').onclick=closeComfort;
el('restContinue').onclick=function(){leaveRest(true)};el('restLater').onclick=function(){leaveRest(false)};
el('comfortDialog').addEventListener('keydown',function(e){trapComfortFocus(el('comfortDialog'),e)});el('restDialog').addEventListener('keydown',function(e){trapComfortFocus(el('restDialog'),e)});
var lastFrame=0,lastAscentReadout=0;function frame(ts){var elapsed=lastFrame?Math.max(0,(ts-lastFrame)/1000):.016,dt=Math.min(.05,elapsed);lastFrame=ts;tickComfort(elapsed);if(S.running)update(dt,elapsed);if(ts-lastAscentReadout>60){syncAscent();lastAscentReadout=ts}draw();requestAnimationFrame(frame)}
el('bStart').onclick=function(){resize();startSession(false)};
el('bEndless').onclick=function(){resize();startSession(false,'endless')};
el('bFinish').onclick=requestFinish;
el('bReview').onclick=function(){resize();startSession(true)};
el('bLevel').onclick=function(){closeMemory(false);S.running=false;if(hasSpeech())window.speechSynthesis.cancel();el('overlay').classList.remove('hide');renderLevels();renderUnits();syncHud()};
el('unitSelect').onchange=function(){S.unit=Number(this.value);this.blur();persist();renderUnits()};
function changeMode(value){S.mode=value;S.typed='';S.badChar='';S.revealed=false;persist();el('modeSelect').value=value;el('playMode').value=value;if(S.running){renderInput();if(value==='listen')speak()}}
el('modeSelect').onchange=function(){changeMode(this.value);this.blur()};el('playMode').onchange=function(){changeMode(this.value);this.blur()};
el('targetSelect').onchange=function(){chooseFocus(reachable()[Number(this.value)]);this.blur()};
el('bSpeak').onclick=speak;el('bReveal').onclick=function(){S.revealed=true;S.aided=true;var target=currentFocus();if(target)S.aidedWords.add(target.w.w);S.feedback='先记住：'+(target?target.w.w:'');renderInput()};
el('bHint').onclick=function(){S.revealed=!S.revealed;if(S.revealed){S.aided=true;var target=currentFocus();if(target)S.aidedWords.add(target.w.w)}renderInput()};el('bSound').onclick=function(){S.snd=!S.snd;el('bSound').textContent='音效：'+(S.snd?'开':'关')};
el('bReset').onclick=function(){if(!confirm('清除本游戏所有学习进度？此操作不可撤回。'))return;
  closeMemory(false);S.recent=[];S.aided=false;S.aidedWords=new Set();if(hasSpeech())window.speechSynthesis.cancel();state=L.empty();
  S.sessionMode='daily';S.practicedWords=new Set();S.completedWords=new Set();S.badChar='';S.composing=false;S.endRequested=false;
  Object.assign(S,{level:1,unit:0,mode:'follow',pool:[],stakes:[],cur:null,focus:null,jump:null,landT:0,running:false,typed:'',revealed:false,feedback:'',pending:false,hits:{},reviewStart:new Set(),baseAltitude:0,startY:0,alt:0,trail:[],jumps:0,errs:0,combo:0,maxCombo:0,score:0,crits:0,critT:0,comboPop:0,playTime:0,last:0,parts:[],texts:[],shake:0,milestoneUntil:0});
  S.robot={x:CW/2,y:0};S.pathX=CW/2;S.cam=-CH*ROBOT_AT;lastFrame=0;el('playMode').value='follow';el('ascentMilestone').hidden=true;el('summary').classList.add('hide');el('overlay').classList.remove('hide');
  persist();renderLevels();renderUnits();syncHud();syncAscent();renderInput();
};
el('sumMenu').onclick=function(){el('summary').classList.add('hide');el('overlay').classList.remove('hide');renderLevels();renderUnits()};
el('sumNext').onclick=function(){if(S.sessionMode==='endless'){startSession(false,'endless');return}if(unitDone()){S.unit++;if(S.unit>=units(S.level)){S.level=Math.min(MAX_LV,S.level+1);S.unit=0}persist();renderUnits()}startSession(!unitDone()&&L.today(state,now()).introduced.length>=state.settings.dailyNew)};
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',function(){if(document.hidden&&comfortPaused()){persist();return}if(document.hidden&&S.running){closeMemory(false);S.running=false;el('overlay').classList.remove('hide');renderLevels();renderUnits();persist()}});
resize();S.robot={x:CW/2,y:S.startY};S.cam=S.startY-CH*ROBOT_AT;applyComfort();buildKb();syncAscent();renderLevels();renderUnits();syncHud();renderInput();syncComfort();showStorageWarning();el('playMode').value=S.mode;el('bSound').textContent='音效：关';requestAnimationFrame(frame);
window.__game=S;


'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),L=require('../learning.js'),A=require('../ascent.js'),vocab=JSON.parse(fs.readFileSync(path.join(root,'data/vocabulary.json'),'utf8'));
let failures=0;
const test=(name,fn)=>{try{fn();console.log('PASS '+name)}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack)}};
test('all source words have a translation and supported input',()=>{
  assert.equal(vocab.length,4129);assert.equal(new Set(vocab.map(w=>w.w)).size,4129);
  vocab.forEach(w=>{assert.match(w.meaning,/[\u4e00-\u9fff]/);assert.match(w.answer,/^[a-z][a-z '-]*$/);assert.ok(['NGSL','TSL','NGSL-SUP','PROJECT'].includes(w.source));assert.ok(w.phonetic&&w.pos&&w.definition)});
});
const time=Date.UTC(2026,9,19,5),data=L.empty();
function master(s,w,at=time){L.answer(s,w,true,at,1);L.answer(s,w,true,at+1,2);L.answer(s,w,true,at+1+L.SHORT_GAP,3);return L.record(s,w)}
test('three correct answers, capped progress, wrong answer and due review',()=>{
  L.answer(data,'work',true,time,1);L.answer(data,'work',true,time+1,2);assert.equal(L.record(data,'work').correct,2);
  L.answer(data,'work',true,time+2,3);assert.equal(L.record(data,'work').correct,2,'early third answer is not mastery');
  L.answer(data,'work',true,time+1+L.SHORT_GAP,4);assert.equal(L.record(data,'work').correct,3);assert.equal(L.record(data,'work').due,time+1+L.SHORT_GAP+L.DAY);
  L.answer(data,'work',false,time+2+L.SHORT_GAP,5);assert.equal(L.record(data,'work').correct,2);assert.equal(L.record(data,'work').mistakes,1);
  L.answer(data,'work',true,time+2+2*L.SHORT_GAP,6);assert.equal(L.record(data,'work').correct,3);
});
test('five new words per day; repeated attempts count once',()=>{
  const s=L.empty(),p=L.plan(s,vocab,1,0,time,false);assert.equal(p.newCount,5);
  p.pool.forEach((w,i)=>L.answer(s,w.w,true,time,i));L.answer(s,p.pool[0].w,true,time+1,6);
  assert.equal(L.today(s,time).introduced.length,5);assert.equal(L.plan(s,vocab,2,0,time,false).newCount,0);
  const tomorrow=L.plan(s,vocab,2,0,time+L.DAY,false);assert.equal(tomorrow.newCount,5);assert.ok(tomorrow.dueCount>0);
  assert.equal(L.plan(s,vocab,2,0,time+L.DAY,true).newCount,0);
});
test('corrupt storage, legacy migration and reload preserve progress',()=>{
  assert.equal(Object.keys(L.load('{bad').words).length,0);
  const migrated=L.load(null,JSON.stringify({1:{office:2,work:3}}));assert.equal(L.record(migrated,'office').correct,2);
  assert.equal(L.record(L.load(JSON.stringify(data)),'work').correct,3);
});

// Strict DOM shell: unlike the old reference test, missing IDs return null.
// This catches input bars deleting elements that later game code still reads.
function boot(store=new Map(),width=820,height=520,reduced=false){
  const viewport={width,height};
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),els={},listeners={};
  const noop=()=>{},gradient={addColorStop:noop};
  const ctx=new Proxy({}, {get(t,k){if(k==='measureText')return text=>({width:text.length*9});if(k.includes('Gradient'))return ()=>gradient;return t[k]||noop},set(t,k,v){t[k]=v;return true}});
  class Element {
    constructor(tag,id){this.tagName=tag.toUpperCase();this.id=id||'';this.children=[];this.dataset={};this.style={};this.value='';this.className='';this.textContent='';this.classList={add:(...names)=>{this.className=[...new Set(this.className.split(' ').concat(names))].join(' ')},remove:(...names)=>{this.className=this.className.split(' ').filter(n=>!names.includes(n)).join(' ')},contains:n=>this.className.split(' ').includes(n)};}
    appendChild(child){this.children.push(child);return child}append(...children){this.children.push(...children)}replaceChildren(...children){this.children=children}insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);return child}
    addEventListener(type,fn){this['on'+type]=fn}blur(){}getBoundingClientRect(){return {width:viewport.width,height:viewport.height,left:0,top:0}}getContext(){return ctx}
  }
  for(const m of html.matchAll(/id="([^"]+)"/g))els[m[1]]=new Element('div',m[1]);
  els.overlay.className='';els.summary.className='hide';
  const document={activeElement:{tagName:'BODY'},hidden:false,getElementById:id=>els[id]||null,createElement:tag=>new Element(tag),querySelector:()=>null,addEventListener:(type,fn)=>{listeners[type]=fn}};
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)};
  let clock=0;
  const sandbox={document,localStorage,console,Date,Intl,performance:{now:()=>clock},requestAnimationFrame:noop,setTimeout:fn=>{fn();return 1},confirm:()=>false};
  sandbox.window=sandbox;sandbox.addEventListener=noop;sandbox.devicePixelRatio=1;sandbox.matchMedia=()=>({matches:reduced});
  vm.createContext(sandbox);
  for(const filename of ['vocabulary.js','learning.js','ascent.js','memory.js','comfort.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),sandbox,{filename});
  function frames(n=75){for(let i=0;i<n;i++){clock+=16;if(sandbox.S.running)sandbox.update(.016)}}
  function type(word){for(const c of word)sandbox.onKey(c)}
  return {g:sandbox,els,store,frames,type,listeners,ctx,setSize(w,h){viewport.width=w;viewport.height=h;sandbox.resize()}};
}
test('two initial successes finish the daily block; delayed review earns third mastery',()=>{
  const b=boot();b.els.bStart.onclick();assert.equal(b.g.S.running,true);assert.equal(b.g.S.pool.length,5);
  let steps=0;
  while(b.g.S.running&&steps++<150){
    const options=b.g.reachable();if(!options.length){b.frames();continue}
    const remaining=options.find(s=>!b.g.finished(s.w));b.g.chooseFocus(remaining||options[0]);
    b.type(b.g.S.focus.w.answer);assert.ok(b.g.S.jump);b.frames();
  }
  assert.ok(steps<150,'session must finish, rather than repeatedly serving mastered words');assert.equal(b.g.S.running,false);
  assert.equal(b.els.summary.classList.contains('hide'),false);assert.equal(b.g.S.jumps,10);
  assert.equal(b.g.S.pool.every(w=>b.g.record(w.w).correct===2),true);
  assert.match(b.els.routeDesc.textContent,/已完成|基础高频词/);
  const restored=boot(b.store);assert.equal(restored.g.L.stats(restored.g.state,restored.g.VOCAB).learned,0);
  restored.els.bReview.onclick();assert.equal(restored.g.S.running,false);assert.match(restored.els.menuStatus.textContent,/分钟后/);
  restored.g.now=()=>Date.now()+L.SHORT_GAP+10;restored.els.bReview.onclick();assert.equal(restored.g.S.pool.length,5);
  let guard=0;while(restored.g.S.running&&guard++<30){restored.type(restored.g.currentFocus().w.answer);restored.frames()}
  assert.equal(restored.g.L.stats(restored.g.state,restored.g.VOCAB).learned,5);assert.equal(restored.g.L.today(restored.g.state,Date.now()).introduced.length,5);
});
test('wrong input reveals answer without stranding learner, recall and unsupported speech',()=>{
  const b=boot(new Map(),375);b.els.bStart.onclick();const target=b.g.currentFocus();
  b.type(target.w.answer[0]==='z'?'x':'z');assert.equal(b.g.S.errs,1);assert.equal(b.g.S.revealed,true);assert.equal(target.state,'live');
  b.type(target.w.answer);assert.ok(b.g.S.jump);b.frames();b.g.changeMode('recall');assert.equal(b.g.shownWord(b.g.currentFocus().w).includes('•'),true);
  b.els.bSpeak.onclick();assert.match(b.g.S.feedback,/不支持/);
});
test('world landmarks move down with climbing and milestone crossings occur once',()=>{
  assert.ok(A.screenY(100,-700)>A.screenY(100,-400));
  assert.equal(A.crossed(90,105).height,100);assert.equal(A.crossed(105,140),null);
  assert.equal(A.info(600).current.name,'穿过云海');assert.equal(A.info(2999).next.height,3000);assert.equal(A.crossed(2999,3020).height,3000);
});
test('landed altitude persists, sessions resume above ground, mistakes never erase ascent',()=>{
  const b=boot();b.els.bStart.onclick();const target=b.g.currentFocus(),targetY=target.y;
  b.type(target.w.answer);assert.equal(b.g.state.journey.height,0,'no credit for an unfinished jump');
  b.frames();const firstHeight=b.g.state.journey.height;
  assert.equal(firstHeight,Math.round(-targetY*A.METERS_PER_PIXEL));assert.equal(b.g.state.journey.jumps,1);
  assert.equal(Number(b.els.altHeight.textContent.replaceAll(',','')),firstHeight);
  const restored=boot(b.store);assert.equal(restored.g.state.journey.height,firstHeight);restored.els.bStart.onclick();
  assert.equal(restored.g.S.baseAltitude,firstHeight);assert.ok(restored.g.S.robot.y<0);
  const next=restored.g.currentFocus();restored.type(next.w.answer[0]==='z'?'x':'z');assert.equal(restored.g.state.journey.height,firstHeight);
  restored.type(next.w.answer);restored.frames();assert.ok(restored.g.state.journey.height>firstHeight);
});
test('resize while airborne preserves landing and narrow screens do not duplicate same-row platforms',()=>{
  const b=boot();b.els.bStart.onclick();const target=b.g.currentFocus();b.type(target.w.answer);b.frames(10);b.setSize(375,400);b.frames();
  assert.equal(b.g.S.cur,target);assert.ok(b.g.S.robot.x>=89&&b.g.S.robot.x<=286);
  const rows=b.g.S.stakes.map(s=>s.y);assert.equal(new Set(rows).size,rows.length);
  b.g.draw();b.setSize(1100,650);b.g.draw();assert.equal(b.g.S.jump,null);
});
test('word targets clear the robot head and desktop reference panels',()=>{
  for(const [width,height] of [[375,300],[390,470],[820,260],[1180,430]]){
    const b=boot(new Map(),width,height);b.els.bStart.onclick();
    b.g.reachable().forEach(s=>{
      assert.ok(s.y-b.g.S.robot.y+43<-90,'word must sit above robot head');
      if(width>760){assert.ok(s.x-74>=186);assert.ok(s.x+74<=width-223)}
    });
  }
});
test('reduced-motion path and old saves retain learning progress without fabricating height',()=>{
  const migrated=L.load(JSON.stringify({version:2,words:{work:{correct:3}},days:{},settings:{}}));assert.equal(migrated.journey.height,0);assert.equal(migrated.words.work.correct,3);
  const b=boot(new Map(),375,400,true);b.els.bStart.onclick();b.type(b.g.currentFocus().w.answer);
  // OS reduced-motion keeps the essential jump, but lowers the arc and duration.
  assert.ok(b.g.S.jump.arc>=46&&b.g.S.jump.arc<80);assert.equal(b.g.S.jump.dur,300);b.frames();assert.equal(b.g.state.journey.jumps,1);b.g.draw();
});
test('same-day extra practice never inflates the spaced-review interval',()=>{
  const s=L.empty();master(s,'work');
  const firstDue=L.record(s,'work').due;
  for(let n=4;n<=9;n++)L.answer(s,'work',true,time+n,n);
  assert.equal(L.record(s,'work').due,firstDue);assert.equal(L.record(s,'work').reviews,0);
  L.answer(s,'work',true,firstDue+10,10);const nextDue=L.record(s,'work').due;
  assert.equal(nextDue,firstDue+10+2*L.DAY);assert.equal(L.record(s,'work').reviews,1);
  L.answer(s,'work',true,firstDue+20,11);assert.equal(L.record(s,'work').due,nextDue);assert.equal(L.record(s,'work').reviews,1);
});
test('clear progress resets both the saved journey and the visible world',()=>{
  const b=boot();b.els.bStart.onclick();b.type(b.g.currentFocus().w.answer);b.frames();
  b.g.S.baseAltitude=600;b.g.S.alt=60;b.g.confirm=()=>true;b.els.bReset.onclick();
  assert.equal(b.g.state.journey.height,0);assert.equal(b.g.S.baseAltitude,0);assert.equal(b.g.S.alt,0);
  assert.equal(b.els.altHeight.textContent,'0');assert.equal(b.g.S.robot.y,0);assert.equal(b.g.S.jump,null);
});
test('learning duration uses elapsed time rather than capped animation time',()=>{
  const b=boot();b.els.bStart.onclick();b.g.frame(1000);b.g.frame(6000);
  assert.ok(b.g.S.playTime>=5&&b.g.S.playTime<5.1,'five elapsed seconds must not become fifty milliseconds');
});
test('long fading hints stay compact and canvas text is constrained to its paper label',()=>{
  const b=boot();b.els.bStart.onclick();const w=b.g.VOCAB.find(w=>w.answer.length>=15);
  b.g.L.answer(b.g.state,w.w,true,time,1);
  assert.ok(b.g.shownWord(w).length<=w.answer.length+1,'one placeholder per hidden letter');
  const drawn=[];b.ctx.fillText=(...args)=>drawn.push(args);const target=b.g.currentFocus();target.w=w;b.g.drawStake(target);
  assert.equal(drawn[0][3],b.g.STAKE_W-30,'long labels must have a maximum drawing width');
});
test('answer hint controls describe their current state',()=>{
  const b=boot();b.els.bStart.onclick();b.els.bHint.onclick();
  assert.match(b.els.bHint.textContent,/收起/);b.els.bHint.onclick();assert.match(b.els.bHint.textContent,/显示/);
});
test('optional review before its due time does not postpone the next review',()=>{
  const s=L.empty();const first=master(s,'work').due;
  L.answer(s,'work',true,first+10,4);const due=L.record(s,'work').due;
  L.answer(s,'work',true,first+L.DAY,5);
  assert.equal(L.record(s,'work').due,due);assert.equal(L.record(s,'work').reviews,1);
  L.answer(s,'work',true,due,6);assert.equal(L.record(s,'work').reviews,2);assert.equal(L.record(s,'work').due,due+4*L.DAY);
});
test('old first-day review inflation is repaired without losing mastery or height',()=>{
  const s=L.empty();master(s,'work');
  s.words.work.reviews=6;s.words.work.due=time+30*L.DAY;s.journey.height=321;
  const restored=L.load(JSON.stringify(s));assert.equal(restored.words.work.correct,3);assert.equal(restored.words.work.reviews,0);assert.ok(restored.words.work.due<=time+1+L.SHORT_GAP+L.DAY);assert.equal(restored.journey.height,321);
  s.days={[L.dayKey(time-L.DAY)]:{introduced:['work'],right:3,wrong:0}};s.words.work.reviews=1;s.words.work.due=time+2*L.DAY;
  const genuine=L.load(JSON.stringify(s));assert.equal(genuine.words.work.reviews,1);assert.equal(genuine.words.work.due,time+2*L.DAY);
});
test('automatic focus prefers unfinished words but manual target choice is respected',()=>{
  const b=boot();b.els.bStart.onclick();const first=b.g.currentFocus(),otherWord=b.g.S.pool.find(w=>w.w!==first.w.w);
  b.g.state.words[first.w.w]={correct:3,last:time,due:time+L.DAY,reviews:0};
  const second={...first,x:first.x+10,y:first.y-4,w:otherWord};b.g.S.stakes=[b.g.S.cur,first,second];b.g.S.focus=null;
  assert.equal(b.g.currentFocus(),second);b.g.chooseFocus(first);assert.equal(b.g.currentFocus(),first);
});
test('storage failures stay visible during play and disappear after a successful save',()=>{
  const b=boot(),save=b.g.localStorage.setItem;b.g.localStorage.setItem=()=>{throw Error('quota')};b.els.bStart.onclick();
  assert.equal(b.els.storageNotice.hidden,false);assert.match(b.els.storageNotice.textContent,/未能保存/);
  b.g.localStorage.setItem=save;b.g.persist();assert.equal(b.els.storageNotice.hidden,true);
});
test('canceling reset leaves all progress intact and inactive answer controls are disabled',()=>{
  const b=boot();assert.equal(b.els.bHint.disabled,true);assert.equal(b.els.bSpeak.disabled,true);assert.equal(b.els.bReveal.disabled,true);
  b.els.bStart.onclick();b.type(b.g.currentFocus().w.answer);b.frames();const height=b.g.state.journey.height;
  b.els.bReset.onclick();assert.equal(b.g.state.journey.height,height);assert.equal(b.g.S.running,true);
});
test('unlimited mode bypasses the daily new-word allowance',()=>{
  const s=L.empty();const first=L.plan(s,vocab,1,0,time,false).pool;
  first.forEach(w=>master(s,w.w));
  assert.equal(L.plan(s,vocab,1,0,time+10,false).newCount,0);
  const unlimited=L.plan(s,vocab,1,0,time+10,false,true);assert.equal(unlimited.newCount,5);assert.ok(unlimited.pool.every(w=>!first.includes(w)));
});
test('endless batches continue automatically beyond five new words and can be ended',()=>{
  const b=boot();b.els.bEndless.onclick();const first=b.g.S.pool.map(w=>w.w);let steps=0;
  while(b.g.S.batches<2&&steps++<160){const options=b.g.reachable();const target=options.find(s=>!b.g.finished(s.w))||options[0];b.g.chooseFocus(target);b.type(target.w.answer);b.frames();}
  assert.ok(steps<160);assert.equal(b.g.S.running,true);assert.equal(b.els.summary.classList.contains('hide'),true);assert.equal(b.g.S.completedWords.size,0);assert.equal(steps,10);
  assert.ok(b.g.S.pool.some(w=>!first.includes(w.w)));const jumps=b.g.S.jumps,alt=b.g.state.journey.height;
  b.type(b.g.currentFocus().w.answer);b.frames();assert.ok(b.g.L.today(b.g.state,Date.now()).introduced.length>5);assert.ok(b.g.S.jumps>jumps);assert.ok(b.g.state.journey.height>alt);
  b.els.bFinish.onclick();assert.equal(b.g.S.running,false);assert.equal(b.els.summary.classList.contains('hide'),false);assert.match(b.els.sumNext.textContent,/无限/);
});
test('endless mode advances units without resetting the world or session score',()=>{
  const b=boot();b.g.now=()=>time;const ws=b.g.L.unitWords(b.g.VOCAB,1,0);
  ws.slice(0,19).forEach(w=>{b.g.state.words[w.w]={correct:3,last:time,due:time+L.DAY,reviews:0,mistakes:0}});
  b.els.bEndless.onclick();let guard=0;while(b.g.S.unit===0&&guard++<30){b.type(b.g.currentFocus().w.answer);b.frames();}
  // The next unit can be previewed before the last word's second hit. Visiting
  // those fixed islands must not reset the world or strand the outstanding word.
  assert.equal(b.g.S.unit,1);assert.ok(b.g.S.jumps>=2&&b.g.S.jumps<=2+b.g.AHEAD*2);assert.equal(b.g.record(ws[19].w).correct,2);assert.ok(b.g.S.score>0);assert.ok(b.g.S.alt>0);assert.equal(b.g.S.running,true);
});
test('finish requested in midair waits for the correct landing',()=>{
  const b=boot();b.els.bEndless.onclick();b.type(b.g.currentFocus().w.answer);b.els.bFinish.onclick();
  assert.equal(b.g.S.running,true);assert.equal(b.g.state.journey.height,0);b.frames();assert.equal(b.g.S.running,false);assert.ok(b.g.state.journey.height>0);
});
test('typing shows current position, progress and preserves the valid prefix after errors',()=>{
  const b=boot();b.els.bEndless.onclick();const w=b.g.currentFocus().w;assert.equal(w.answer,'you');
  b.type('y');assert.equal(b.els.inputCount.textContent,'1 / 3');assert.match(b.els.typingPanel.className,/typing/);assert.equal(b.els.inputTrack.children[0].textContent,'y');assert.match(b.els.inputTrack.children[1].className,/current/);
  b.type('z');assert.equal(b.g.S.typed,'y');assert.equal(b.g.S.badChar,'z');assert.match(b.els.typingPanel.className,/error/);assert.ok(b.els.inputTrack.children.some(c=>c.className.includes('bad')));
  b.g.back();assert.equal(b.g.S.typed,'y');assert.equal(b.g.S.badChar,'');b.type('ou');assert.ok(b.g.S.jump);assert.equal(b.els.typingCapture.value,'you');assert.equal(b.els.inputCount.textContent,'3 / 3');assert.equal(b.els.inputProgress.style.width,'100%');assert.match(b.els.typingPanel.className,/success/);
});
test('native input supports typed text and paste without counting Chinese composition as mistakes',()=>{
  const b=boot();b.els.bEndless.onclick();b.els.typingCapture.value='y';b.els.typingCapture.oninput();assert.equal(b.g.S.typed,'y');
  b.els.typingCapture.oncompositionstart();b.els.typingCapture.value='你好';b.els.typingCapture.oncompositionend();assert.equal(b.g.S.errs,0);assert.equal(b.g.S.typed,'y');assert.match(b.els.inputStatus.textContent,/英文键盘/);
  b.els.typingCapture.value='you';b.els.typingCapture.oninput();assert.ok(b.g.S.jump);assert.equal(b.g.S.jumps,1);
});
test('recall input reveals the entered prefix without leaking the remaining answer',()=>{
  const b=boot();b.els.bEndless.onclick();b.g.changeMode('recall');b.type('y');
  assert.equal(b.els.inputTrack.children[0].textContent,'y');assert.equal(b.els.inputTrack.children[1].textContent,'·');assert.equal(b.els.inputTrack.children[2].textContent,'·');
});
test('endless play crosses a fully mastered level without being stopped by daily limits',()=>{
  const b=boot();b.g.now=()=>time;b.g.VOCAB.filter(w=>w.stage===1).forEach(w=>{b.g.state.words[w.w]={correct:3,last:time,due:time+L.DAY,reviews:0,mistakes:0}});
  b.els.bEndless.onclick();assert.equal(b.g.S.level,2);assert.equal(b.g.S.unit,0);assert.ok(b.g.S.pool.every(w=>w.stage===2));assert.equal(b.g.S.running,true);
});
test('fully mastered vocabulary remains playable and fallback reviews rotate',()=>{
  const b=boot();b.g.now=()=>time;b.g.VOCAB.forEach(w=>{b.g.state.words[w.w]={correct:3,last:time,due:time+L.DAY,reviews:0,mistakes:0}});b.g.S.level=5;b.g.S.unit=b.g.units(5)-1;b.els.bEndless.onclick();
  const first=b.g.S.pool.map(w=>w.w);b.g.S.pool.forEach(w=>b.g.S.hits[w.w]=1);b.g.nextEndlessBatch();assert.ok(b.g.S.pool.every(w=>!first.includes(w.w)));assert.equal(b.g.S.running,true);assert.equal(b.els.summary.classList.contains('hide'),true);
});
test('cooldown survives reload and cannot be bypassed by an early third answer',()=>{
  const s=L.empty();L.answer(s,'work',true,time,1);L.answer(s,'work',true,time+1,2);const due=s.words.work.due;
  const loaded=L.load(JSON.stringify(s));L.answer(loaded,'work',true,due-1,3);assert.equal(loaded.words.work.correct,2);assert.equal(loaded.words.work.due,due);
  assert.equal(L.plan(loaded,vocab,1,0,due-1,true).pool.some(w=>w.w==='work'),false);
  assert.equal(L.plan(loaded,vocab,1,0,due,true).pool.some(w=>w.w==='work'),true);L.answer(loaded,'work',true,due,4);assert.equal(loaded.words.work.correct,3);
});
test('aided delayed recall is practice, not automatic mastery or a longer review interval',()=>{
  const s=L.empty();L.answer(s,'work',true,time,1);L.answer(s,'work',true,time+1,2);const due=s.words.work.due;
  L.answer(s,'work',true,due,3,true);assert.equal(s.words.work.correct,2);assert.equal(s.words.work.due,due+L.SHORT_GAP);
  L.answer(s,'work',true,s.words.work.due,4);assert.equal(s.words.work.correct,3);const masteredDue=s.words.work.due;
  L.answer(s,'work',true,masteredDue-1,5,true);assert.equal(s.words.work.correct,3);assert.equal(s.words.work.due,masteredDue);
});
test('sequential platforms never serve two-hit words during cooldown',()=>{
  const b=boot();b.g.now=()=>time;b.els.bEndless.onclick();const attempts=[];
  for(let n=0;n<60;n++){
    const target=b.g.currentFocus();assert.ok(target);const key=target.w.w;
    assert.ok(b.g.record(key).correct<2,'a cooling word leaked onto an active platform');
    const active=b.g.S.pool.filter(w=>!b.g.finished(w));if(active.some(w=>!b.g.S.recent.includes(w.w)))assert.ok(!b.g.S.recent.includes(key),'recent word should yield to an alternative');
    attempts.push(key);b.type(target.w.answer);b.frames();
  }
  assert.equal(b.g.S.running,true);assert.equal(b.g.S.jumps,60);assert.ok(new Set(attempts).size>=30);assert.ok(Object.values(b.g.state.words).every(r=>r.correct<=2));
});
test('due third retrieval is mixed back into endless batches before new words',()=>{
  const b=boot();let at=time;b.g.now=()=>at;b.els.bEndless.onclick();const first=b.g.S.pool.map(w=>w.w);
  for(let i=0;i<10;i++){b.type(b.g.currentFocus().w.answer);b.frames()}
  assert.equal(b.g.S.batches,2);at+=L.SHORT_GAP+10;
  for(let i=0;i<10;i++){b.type(b.g.currentFocus().w.answer);b.frames()}
  assert.equal(b.g.S.batches,3);assert.ok(first.every(key=>b.g.S.pool.some(w=>w.w===key)));
  const target=b.g.currentFocus();assert.ok(first.includes(target.w.w));assert.match(b.g.shownWord(target.w),/•/);
  b.type(target.w.answer);b.frames();assert.equal(b.g.record(target.w.w).correct,3);assert.equal(b.g.S.completedWords.size,1);
});
test('memory scenes, bilingual examples and links are valid and honestly scoped',()=>{
  const M=require('../memory.js'),cards=vocab.filter(w=>w.memory);assert.equal(cards.length,110);
  cards.forEach(w=>{const m=w.memory;assert.ok(M.scene(m.scene).includes('<svg'));assert.match(m.zh,/[\u4e00-\u9fff]/);assert.ok(m.chunk&&m.en);assert.notEqual(M.masked(m.en,w.w),m.en,'sentence must contain the exact taught form: '+w.w);m.related.forEach(key=>assert.ok(vocab.some(v=>v.w===key),key))});
});
test('memory dialog pauses play, reveals linked content, and returns to the same input',()=>{
  const b=boot();b.els.bEndless.onclick();const target=b.g.currentFocus(),before=b.g.S.playTime;b.els.bMemory.onclick();
  assert.equal(b.els.memoryDialog.hidden,false);assert.equal(b.els.memorySentence.textContent,target.w.memory.en);assert.match(b.els.memoryArt.innerHTML,/<svg/);assert.ok(b.els.memoryRelated.children.length);
  b.type(target.w.answer);b.frames();assert.equal(b.g.S.jumps,0);assert.equal(b.g.S.playTime,before);
  b.els.memoryRelated.children[0].onclick();assert.equal(b.els.memoryBack.hidden,false);b.els.memoryBack.onclick();assert.equal(b.g.S.memoryWord.w,target.w.w);
  b.els.memoryClose.onclick();assert.equal(b.els.memoryDialog.hidden,true);assert.equal(b.g.currentFocus(),target);b.type(target.w.answer);assert.equal(b.g.S.jumps,1);
});
test('recall card hides answer cues until explicitly requested; no unearned third hit',()=>{
  const b=boot();b.g.now=()=>time;const w=b.g.VOCAB.find(w=>w.w==='you');b.g.state.words.you={correct:2,last:time-L.SHORT_GAP,due:time,reviews:0,mistakes:0};b.els.bReview.onclick();
  b.els.bMemory.onclick();assert.equal(b.els.memoryTitle.textContent,'先回忆，再看联想');assert.equal(b.els.memoryArt.innerHTML,'');assert.equal(b.els.memoryRelated.children.length,0);assert.ok(!b.els.memorySentence.textContent.toLowerCase().includes('you'));
  b.els.memoryShow.onclick();assert.equal(b.g.S.aided,true);assert.equal(b.els.memorySentence.textContent,w.memory.en);b.els.memoryClose.onclick();b.g.chooseFocus(b.g.currentFocus());b.type('you');b.frames();assert.equal(b.g.record('you').correct,2);assert.equal(b.g.record('you').due,time+L.SHORT_GAP);
});
test('unwritten memory content is labelled dictionary-only without decorative fake images',()=>{
  const b=boot();b.els.bEndless.onclick();const target=b.g.currentFocus();target.w=b.g.VOCAB.find(w=>!w.memory);b.els.bMemory.onclick();
  assert.match(b.els.memoryNote.textContent,/词典卡/);assert.equal(b.els.memoryFigure.hidden,true);assert.equal(b.els.memorySentence.textContent,'');assert.equal(b.els.memoryDefinition.textContent,target.w.definition);
});
test('every official supplement lemma is represented and business forms are separately practised',()=>{
  const supplement=fs.readFileSync(path.join(root,'data/sources/ngsl-supplement.csv'),'utf8').trim().split(/\r?\n/).map(row=>row.split(',')[0].toLowerCase());
  assert.equal(supplement.length,52);supplement.forEach(key=>assert.ok(vocab.some(w=>w.w===key&&w.supplement)));
  ['march','may'].forEach(key=>assert.match(vocab.find(w=>w.w===key).meaning,/月/));
  ['meeting','sales','shipping','minutes','premises'].forEach(key=>assert.equal(vocab.find(w=>w.w===key).source,'PROJECT'));
});
test('Escape clears native typing and Tab switches targets instead of leaving the game',()=>{
  const b=boot();b.els.bEndless.onclick();b.g.document.activeElement=b.els.typingCapture;b.type('y');let prevented=0;
  b.listeners.keydown({key:'Escape',preventDefault(){prevented++}});assert.equal(b.g.S.typed,'');assert.equal(prevented,1);
  const first=b.g.currentFocus(),other=b.g.S.pool.find(w=>w.w!==first.w.w);b.g.S.stakes.push({...first,x:first.x+5,y:first.y,w:other});
  b.listeners.keydown({key:'Tab',preventDefault(){prevented++}});assert.equal(b.g.currentFocus().w.w,other.w);assert.equal(prevented,2);
});
test('English tokens inside dictionary glosses do not leak the recall answer',()=>{
  const b=boot();b.els.bEndless.onclick();const target=b.g.currentFocus();target.w={...target.w,w:'may',answer:'may',meaning:'modal v. 可以；May 五月'};b.g.changeMode('recall');
  assert.ok(!b.els.promptMeaning.textContent.toLowerCase().includes('may'));b.els.bMemory.onclick();assert.ok(!b.els.memoryMeaning.textContent.toLowerCase().includes('may'));
});
test('landing never rewrites words or positions on existing world platforms',()=>{
  const b=boot();b.els.bEndless.onclick();const existing=b.g.S.stakes.map(s=>({stake:s,word:s.w,x:s.x,y:s.y}));
  b.type(b.g.currentFocus().w.answer);b.frames();
  existing.filter(row=>b.g.S.stakes.includes(row.stake)).forEach(row=>{assert.equal(row.stake.w,row.word,'visible platform word was replaced');assert.equal(row.stake.x,row.x);assert.equal(row.stake.y,row.y)});
});
test('endless batch transition retains visible platforms instead of clearing the world',()=>{
  const b=boot();b.els.bEndless.onclick();let previousBatch=b.g.S.batches,checked=false;
  for(let i=0;i<20;i++){
    const visible=b.g.S.stakes.filter(s=>s.y>=b.g.S.cam-140&&s.y<=b.g.S.cam+b.g.CH);b.type(b.g.currentFocus().w.answer);b.frames();
    if(b.g.S.batches!==previousBatch){visible.filter(s=>s.y<b.g.S.cam+b.g.CH+200).forEach(s=>assert.ok(b.g.S.stakes.includes(s),'visible scenery disappeared at batch boundary'));checked=true;break;}
  }
  assert.equal(checked,true);
});
test('camera only climbs during a jump, without following the arc back down',()=>{
  const b=boot();b.els.bEndless.onclick();b.type(b.g.currentFocus().w.answer);let cam=b.g.S.cam;
  for(let i=0;i<70;i++){b.frames(1);assert.ok(b.g.S.cam<=cam+.000001,'camera reversed direction with the jump arc');cam=b.g.S.cam;}
});
test('steps are laid ahead of time and only the camera brings them into the picture',()=>{
  const b=boot();b.els.bEndless.onclick();const S=b.g.S;
  const ahead=()=>S.stakes.filter(s=>s.state==='live'&&s!==S.cur&&s.y<S.cur.y).sort((x,y)=>x.y-y.y);
  const steps=ahead();assert.equal(steps.length,b.g.AHEAD,'the whole look-ahead must be laid ahead');
  assert.ok(b.g.stakeScreenY(steps[0])<0,'the far step must wait beyond the top edge, not inside the frame');
  assert.ok(b.g.stakeScreenY(steps[steps.length-1])>0,'the near step must already be readable inside the frame');
  for(let n=0;n<40;n++){
    b.frames(1);
    S.stakes.forEach(s=>assert.equal(b.g.stakeScreenY(s),s.y-S.cam,'no island may animate on its own'));
  }
});
test('the step you jump to already existed before the landing that reveals it',()=>{
  const b=boot();b.els.bEndless.onclick();const S=b.g.S;let deep=0;
  for(let n=0;n<12;n++){
    const target=b.g.currentFocus();assert.ok(target);const known=new Set(S.stakes);
    const laid=S.stakes.filter(s=>s.state==='live'&&s!==S.cur&&s.y<S.cur.y).length;
    b.type(target.w.answer);b.frames();
    const next=b.g.currentFocus();assert.ok(next,'a next step must exist');
    assert.ok(!next.entryLeft,'no drop-in animation may exist');
    if(laid>=2){
      deep++;
      assert.ok(known.has(next),'the next step was created on landing instead of being laid ahead');
      assert.ok(b.g.stakeScreenY(next)>0,'the next step must already be inside the picture');
    }
  }
  assert.ok(deep>=4,'the two-step look-ahead must hold for most of a batch');
});
test('typing stays responsive while the camera is still settling after a landing',()=>{
  const b=boot();b.els.bEndless.onclick();const S=b.g.S;
  const first=b.g.currentFocus();b.type(first.w.answer);
  let frames=0;while(S.jump&&frames++<100)b.frames(1);
  const next=b.g.currentFocus();assert.ok(next);assert.equal(S.cur,first);assert.equal(first.solved,true);
  b.type(next.w.answer[0]);assert.equal(S.typed,next.w.answer[0]);
  b.type(next.w.answer.slice(1));assert.ok(S.jump);
});
test('reduced motion changes nothing about how steps arrive',()=>{
  const b=boot(new Map(),1280,450,true);b.els.bEndless.onclick();const S=b.g.S;
  const ahead=S.stakes.filter(s=>s.state==='live'&&s!==S.cur&&s.y<S.cur.y).sort((x,y)=>x.y-y.y);
  assert.equal(ahead.length,b.g.AHEAD);assert.ok(b.g.stakeScreenY(ahead[0])<0,'the far step still waits above the top edge');
  b.type(b.g.currentFocus().w.answer);b.frames();assert.equal(S.jump,null);
  assert.ok(S.stakes.filter(s=>s.state==='live'&&s!==S.cur&&s.y<S.cur.y).length>=1);
});
test('continuous climbing keeps a bounded history and never resets the camera at a batch boundary',()=>{
  const b=boot();b.g.now=()=>time;b.els.bEndless.onclick();let cam=b.g.S.cam;
  for(let n=0;n<100;n++){
    const target=b.g.currentFocus();b.type(target.w.answer);
    for(let frame=0;frame<75;frame++){b.frames(1);assert.ok(b.g.S.cam<=cam+.000001);assert.ok(cam-b.g.S.cam<20,'camera teleported');cam=b.g.S.cam;}
    const aheacount=b.g.S.stakes.filter(s=>s.state==='live'&&s!==b.g.S.cur&&s.y<b.g.S.cur.y).length;
    assert.ok(aheacount>=1&&aheacount<=b.g.AHEAD,'the look-ahead must stay between one step and the full buffer');assert.ok(b.g.S.stakes.length<=9,'old islands must leave from the bottom, not accumulate forever');
  }
  assert.ok(b.g.S.batches>=11);assert.equal(b.g.S.jumps,100);
});
test('comfort settings sanitize independently and do not replace saved learning data',()=>{
  const C=require('../comfort.js'),bad=C.load('{'),weird=C.load(JSON.stringify({prefs:{minutes:1,size:'tiny',route:'unsafe'},used:-20}));
  assert.equal(bad.prefs.minutes,20);assert.equal(weird.prefs.size,'large');assert.equal(weird.prefs.route,'switchback');assert.equal(weird.used,0);
  const b=boot();b.els.bEndless.onclick();b.type(b.g.currentFocus().w.answer);b.frames();const saved=b.store.get('toeic-learning-v2'),height=b.g.state.journey.height;
  b.els.bComfort.onclick();b.els.comfortSize.value='larger';b.els.comfortMinutes.value='0';b.els.comfortSave.onclick();
  assert.equal(b.store.get('toeic-learning-v2'),saved);const reload=boot(b.store);assert.equal(reload.g.comfort.prefs.size,'larger');assert.equal(reload.g.comfort.prefs.minutes,0);assert.equal(reload.g.state.journey.height,height);
});
test('switchback route spans both directions, stays reachable, and keeps laid words fixed',()=>{
  for(const [width,height] of [[1024,270],[1280,440],[1440,760],[1920,1200]]){
    const b=boot(new Map(),width,height);b.els.bEndless.onclick();let left=false,right=false,min=Infinity,max=-Infinity;
    for(let n=0;n<32;n++){
      const t=b.g.currentFocus(),dx=t.x-b.g.S.cur.x,before=b.g.S.stakes.map(s=>({s,x:s.x,y:s.y,font:s.fontSize,w:s.w}));
      left=left||dx<0;right=right||dx>0;min=Math.min(min,t.x);max=Math.max(max,t.x);
      assert.ok(Math.hypot(dx,t.y-b.g.S.cur.y)<=b.g.MAXJ);
      assert.ok(t.x-b.g.STAKE_W/2>=190);assert.ok(t.x+b.g.STAKE_W/2<=width-233);
      b.type(t.w.answer);b.frames();before.filter(r=>b.g.S.stakes.includes(r.s)).forEach(r=>{assert.equal(r.s.x,r.x);assert.equal(r.s.y,r.y);assert.equal(r.s.w,r.w);assert.equal(r.s.fontSize,r.font)});
    }
    assert.ok(left&&right,'route must turn, not drift forever');assert.ok(max-min>100);
  }
});
test('comfort font floor and every vocabulary word fit in at most two readable lines',()=>{
  const C=require('../comfort.js');for(const size of ['normal','large','larger'])for(const varied of [true,false])for(let i=0;i<4;i++){
    const font=C.font({size,varied},i);assert.ok(font>=20&&font<=32);
    vocab.forEach(w=>{let f=font,rows;do{rows=C.wrap(w.answer,178,s=>s.length*f*.66);if(rows.length<=2||f<=20)break;f--}while(true);assert.ok(rows.length<=2);assert.ok(f>=20);assert.equal(rows.map(r=>r.text).join(''),w.answer);rows.forEach(r=>assert.ok(r.text.length*f*.66<=178));});
  }
});
test('changing route at the side of the scene returns to center gradually without a stranded step',()=>{
  for(const height of [300,600,1200]){
    const b=boot(new Map(),1440,height);b.els.bEndless.onclick();b.g.comfort.prefs.route='center';
    for(let n=0;n<20;n++){const target=b.g.currentFocus();assert.ok(target,'center transition must stay reachable');assert.ok(Math.hypot(target.x-b.g.S.cur.x,target.y-b.g.S.cur.y)<=300);b.type(target.w.answer);b.frames()}
    const bounds=b.g.routeBounds();assert.ok(Math.abs(b.g.S.cur.x-(bounds.left+bounds.right)/2)<1);
  }
  const C=require('../comfort.js'),next=C.nextX(1091,306,1091,1,'center',280);assert.ok(Math.hypot(next.x-1091,280)<=300);
});
test('automatic break waits for the typed word and landing, then freezes input without losing it',()=>{
  const b=boot();b.els.bEndless.onclick();let clock=time;b.g.now=()=>clock;const t=b.g.currentFocus();b.type(t.w.answer[0]);b.g.comfort.used=20*60000;
  b.g.tickComfort(0);assert.equal(b.g.S.restOpen,false);b.type(t.w.answer.slice(1));b.g.tickComfort(0);assert.equal(b.g.S.restOpen,false);b.frames();b.g.tickComfort(0);assert.equal(b.g.S.restOpen,true);
  const before=JSON.stringify(b.g.state),jumps=b.g.S.jumps;b.type('xxx');b.frames();assert.equal(b.g.S.jumps,jumps);assert.equal(JSON.stringify(b.g.state),before);assert.equal(b.els.typingCapture.readOnly,true);assert.equal(b.els.stage.inert,true);
  b.els.restContinue.onclick();assert.equal(b.g.S.restOpen,true);clock+=20001;b.g.syncComfort();assert.equal(b.els.restContinue.disabled,false);assert.equal(b.g.S.restOpen,true,'must not auto-resume');b.els.restContinue.onclick();assert.equal(b.g.S.restOpen,false);assert.equal(b.g.comfort.used,0);assert.equal(b.els.stage.inert,false);assert.equal(b.g.S.running,true);
});
test('manual break and comfort dialog preserve a partial word, Escape postpones without clearing it',()=>{
  const b=boot();b.els.bEndless.onclick();const t=b.g.currentFocus();b.type(t.w.answer[0]);const prefix=b.g.S.typed;
  b.els.bComfort.onclick();b.g.back();b.type('z');assert.equal(b.g.S.typed,prefix);b.els.comfortSave.onclick();assert.equal(b.g.S.typed,prefix);assert.equal(b.g.currentFocus(),t);
  b.els.bRest.onclick();b.listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(b.g.S.restOpen,false);assert.equal(b.g.S.typed,prefix);assert.equal(b.g.comfort.snooze,300000);
  b.g.tickComfort(60);assert.ok(b.g.comfort.snooze>0);assert.equal(b.g.S.restOpen,false);
});
test('rest stays available when reminders are disabled; hidden pages add no screen time',()=>{
  const b=boot();b.els.bEndless.onclick();b.g.comfort.prefs.minutes=0;b.g.comfort.used=99999999;b.g.tickComfort(1);assert.equal(b.g.S.restOpen,false);
  b.els.bRest.onclick();assert.equal(b.g.S.restOpen,true);b.els.restLater.onclick();b.g.comfort.prefs.minutes=20;b.g.comfort.used=0;b.g.document.hidden=true;b.g.tickComfort(60);assert.equal(b.g.comfort.used,0);
  b.g.document.hidden=false;b.g.tickComfort(60);assert.equal(b.g.comfort.used,60000);
});
test('postponing an early manual rest really reminds after five active minutes and survives reload',()=>{
  const C=require('../comfort.js'),c=C.load(null);C.advance(c,60000);C.postpone(c);assert.equal(C.remaining(c),300000);
  const restored=C.load(C.save(c));assert.equal(restored.snooze,300000);assert.equal(restored.used,60000);assert.equal(C.due(restored),false);
  for(let n=0;n<5;n++)C.advance(restored,60000);assert.equal(C.due(restored),true);assert.equal(C.remaining(restored),0);
  C.begin(restored,time);assert.equal(C.finish(restored,time+20000),true);assert.equal(C.due(restored),false);
});
test('manual rest requested in midair waits for landing and reduced motion respects OS',()=>{
  const b=boot(new Map(),1280,450,true);b.els.bEndless.onclick();b.type(b.g.currentFocus().w.answer);b.els.bRest.onclick();assert.equal(b.g.S.restRequested,true);assert.equal(b.g.S.restOpen,false);b.frames();b.g.tickComfort(0);assert.equal(b.g.S.restOpen,true);b.els.restLater.onclick();b.els.bComfort.onclick();b.els.comfortCalm.checked=false;b.els.comfortSave.onclick();assert.equal(b.g.S.reduced,true);
});
test('default calm is a real short ballistic jump, not a zero-arc glide',()=>{
  const b=boot(new Map(),1424,928);b.els.bEndless.onclick();assert.equal(b.g.S.reduced,true);assert.equal(b.g.S.osReduced,false);b.type(b.g.currentFocus().w.answer);
  const j=b.g.S.jump;assert.ok(j.arc>=76);assert.ok(j.dur>=300&&j.dur<=390);
  const begin=b.g.jumpPosition(j,0),middle=b.g.jumpPosition(j,.5),end=b.g.jumpPosition(j,1);
  assert.equal(begin.x,j.fx);assert.equal(begin.y,j.fy);assert.equal(end.x,j.tx);assert.equal(end.y,j.ty);
  assert.ok(middle.y<((j.fy+j.ty)/2)-70,'feet must rise well above the support line');
  assert.ok(b.g.jumpPosition(j,.92).y<b.g.jumpPosition(j,.98).y,'must descend before landing');
  let guard=0;while(b.g.S.jump&&guard++<60)b.frames(1);assert.equal(b.g.S.cur,j.target);assert.ok(b.g.S.landT>0);b.frames(20);assert.equal(b.g.S.landT,0);
});
test('OS reduced motion still hops instead of silently forcing a straight glide',()=>{
  const normal=boot(new Map(),1424,928),low=boot(new Map(),1424,928,true);normal.els.bEndless.onclick();low.els.bEndless.onclick();normal.type(normal.g.currentFocus().w.answer);low.type(low.g.currentFocus().w.answer);
  const j=low.g.S.jump;assert.ok(j.arc>0&&j.arc<normal.g.S.jump.arc);assert.ok(j.dur<normal.g.S.jump.dur);
  assert.ok(low.g.jumpPosition(j,.5).y<(j.fy+j.ty)/2-45);assert.ok(low.g.jumpPosition(j,.97).y<low.g.jumpPosition(j,1).y,'low-motion hop must also land downwards');
});
test('tall desktop windows use compact steps and preload beyond the top from the start',()=>{
  for(const height of [450,704,928,1200]){
    const b=boot(new Map(),1424,height);b.els.bEndless.onclick();const above=b.g.S.stakes.filter(s=>s.y<b.g.S.cur.y);
    assert.ok(b.g.stepGap()>=152&&b.g.stepGap()<=184);assert.equal(above.length,b.g.AHEAD);
    assert.ok(Math.min(...above.map(s=>b.g.stakeScreenY(s)))<=-100,'far step must wait above the viewport');
    if(height>=928)assert.ok(above.filter(s=>b.g.stakeScreenY(s)>0).length>=3,'at least three upcoming steps must already be visible');
  }
});
test('next-batch preview is read-only, not a learned word or a new-word quota event',()=>{
  const b=boot(new Map(),1424,928);b.g.now=()=>time;b.els.bEndless.onclick();const before=JSON.stringify(b.g.state);
  const preview=b.g.upcomingWords();assert.ok(preview.length);assert.ok(preview.every(w=>!b.g.S.pool.some(p=>p.w===w.w)));
  assert.equal(JSON.stringify(b.g.state),before);assert.equal(b.g.L.today(b.g.state,time).introduced.length,0);
  assert.equal(b.g.S.jumps,0);const same=b.g.upcomingWords();assert.equal(same,preview,'same-frame forecast should be cached');
});
test('tall-window batch tails keep a full route without duplicate future words or cool-down leaks',()=>{
  const b=boot(new Map(),1424,928);b.g.now=()=>time;b.els.bEndless.onclick();let batches=1;
  for(let i=0;i<80;i++){
    const S=b.g.S,above=S.stakes.filter(s=>s.state==='live'&&s.y<S.cur.y);
    assert.equal(above.length,b.g.AHEAD,'batch tail must not run out of scenery');assert.equal(new Set(above.map(s=>s.w.w)).size,above.length);
    const t=b.g.currentFocus();assert.ok(t);assert.ok(b.g.record(t.w.w).correct<2,'must not use cooling words to fill the route');
    const existing=above.map(s=>({s,x:s.x,y:s.y,w:s.w}));b.type(t.w.answer);b.frames();
    existing.filter(r=>S.stakes.includes(r.s)).forEach(r=>{assert.equal(r.s.x,r.x);assert.equal(r.s.y,r.y);assert.equal(r.s.w,r.w)});
    batches=Math.max(batches,S.batches);assert.ok(S.stakes.length<=b.g.AHEAD+5);
  }
  assert.ok(batches>=5);assert.equal(b.g.S.jumps,80);assert.ok(Object.values(b.g.state.words).every(r=>r.correct<=2));
});
test('camera catches up by landing without following the falling leg of the jump',()=>{
  const b=boot(new Map(),1424,928);b.els.bEndless.onclick();b.type(b.g.currentFocus().w.answer);let cam=b.g.S.cam,guard=0;
  while(b.g.S.jump&&guard++<60){b.frames(1);assert.ok(b.g.S.cam<=cam+.000001);assert.ok(cam-b.g.S.cam<20);cam=b.g.S.cam;}
  const targetCam=b.g.S.robot.y-b.g.CH*b.g.ROBOT_AT;assert.ok(Math.abs(b.g.S.cam-targetCam)<45,'landing must not leave a long camera catch-up wait');
  const next=b.g.currentFocus();b.type(next.w.answer);assert.ok(b.g.S.jump,'next jump must work immediately without waiting for camera');
});
test('preloaded future islands do not starve newly due third recalls in a tall window',()=>{
  const b=boot(new Map(),1424,928);let at=time;b.g.now=()=>at;b.els.bEndless.onclick();const first=b.g.S.pool.map(w=>w.w);
  for(let i=0;i<10;i++){b.type(b.g.currentFocus().w.answer);b.frames()}
  at+=L.SHORT_GAP+1;let retrieved=false;
  for(let i=0;i<30;i++){const t=b.g.currentFocus(),r=b.g.record(t.w.w),due=first.includes(t.w.w)&&r.correct===2&&r.due<=at;b.type(t.w.answer);b.frames();if(due){assert.equal(b.g.record(t.w.w).correct,3);retrieved=true;break;}}
  assert.equal(retrieved,true,'fixed look-ahead must not starve due recalls');
});
test('slow rendering does not stretch a short jump into seconds of drifting',()=>{
  const b=boot(new Map(),1424,928);b.els.bEndless.onclick();const target=b.g.currentFocus();b.type(target.w.answer);const duration=b.g.S.jump.dur;
  b.g.update(.05,.20);assert.ok(b.g.S.jump);assert.ok(Math.abs(b.g.S.jump.t-.20*1000/duration)<.000001);
  b.g.update(.05,.20);assert.equal(b.g.S.jump,null);assert.equal(b.g.S.cur,target);assert.equal(b.g.state.journey.jumps,1);
});
if(failures){console.error(failures+' check(s) failed.');process.exitCode=1}else console.log('All checks passed.');

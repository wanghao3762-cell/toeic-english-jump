/* Visual comfort helpers. Gameplay choices are not medical vision therapy. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ToeicComfort=factory()})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var MINUTE=60000,REST=20000;
  function load(raw){
    var r={};try{r=JSON.parse(raw)||{}}catch(e){r={}}
    var p=r.prefs||{},used=Number(r.used);
    return {prefs:{route:p.route==='center'?'center':'switchback',size:['normal','large','larger'].includes(p.size)?p.size:'large',varied:p.varied!==false,calm:p.calm!==false,minutes:[0,10,20,30].includes(p.minutes)?p.minutes:20},used:Number.isFinite(used)?Math.max(0,Math.min(used,30*MINUTE)):0,snooze:Number.isFinite(r.snooze)?Math.max(0,Math.min(r.snooze,5*MINUTE)):0,snoozed:r.snoozed===true,restUntil:0};
  }
  function save(c){return JSON.stringify({prefs:c.prefs,used:c.used,snooze:c.snooze,snoozed:c.snoozed})}
  function advance(c,ms){if(c.prefs.minutes)c.used+=Math.max(0,Math.min(Number(ms)||0,60000));if(c.snooze)c.snooze=Math.max(0,c.snooze-Math.max(0,Math.min(Number(ms)||0,60000)))}
  function due(c){return !!c.prefs.minutes&&!c.snooze&&(c.snoozed||c.used>=c.prefs.minutes*MINUTE)}
  function remaining(c){return c.prefs.minutes?(c.snoozed?c.snooze:Math.max(c.prefs.minutes*MINUTE-c.used,0)):0}
  function begin(c,at){c.restUntil=at+REST}
  function restLeft(c,at){return Math.max(0,c.restUntil-at)}
  function finish(c,at){if(!c.restUntil||restLeft(c,at)>0)return false;c.used=0;c.snooze=0;c.snoozed=false;c.restUntil=0;return true}
  function postpone(c){c.restUntil=0;c.snoozed=!!c.prefs.minutes;c.snooze=c.snoozed?5*MINUTE:0}
  function nextX(x,left,right,direction,mode,gap){
    // Leave a reachability margin at the tallest camera-dependent step gap.
    var stride=Math.min(172,Math.max(32,(right-left)/3),Math.sqrt(Math.max(0,290*290-gap*gap)));
    if(mode==='center')return {x:Math.max(left,Math.min(right,x+Math.max(-stride,Math.min(stride,(left+right)/2-x)))),direction:direction};
    var dir=direction<0?-1:1;if(x+dir*stride<left||x+dir*stride>right)dir=-dir;
    return {x:Math.max(left,Math.min(right,x+dir*stride)),direction:dir};
  }
  function font(p,index){var base={normal:22,large:26,larger:30}[p.size]||26;return base+(p.varied?[0,2,0,-2][Math.abs(index||0)%4]:0)}
  function wrap(text,width,measure){
    var lines=[],line='',start=0;
    Array.from(text).forEach(function(ch){if(line&&measure(line+ch)>width){lines.push({text:line,start:start});start+=line.length;line=''}line+=ch});
    if(line)lines.push({text:line,start:start});return lines;
  }
  return {load:load,save:save,advance:advance,due:due,remaining:remaining,begin:begin,restLeft:restLeft,finish:finish,postpone:postpone,nextX:nextX,font:font,wrap:wrap,REST:REST};
});

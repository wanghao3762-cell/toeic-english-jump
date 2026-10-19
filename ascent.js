/* World-space scenery: the camp, rope knots and altitude flags never wrap. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ToeicAscent=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var METERS_PER_PIXEL=.35;
  var MILESTONES=[
    {height:0,name:'山脚营地',message:'每一个单词，都是向上的一步。'},
    {height:100,name:'离开起点',message:'已经离开起点。你的第一段攀登完成了。'},
    {height:300,name:'越过林梢',message:'抬头看，你已经比出发时更高了。'},
    {height:600,name:'穿过云海',message:'一步一步，你已经走进了云端。'},
    {height:1000,name:'抵达晴空',message:'第一千米。坚持留下了看得见的足迹。'},
    {height:2000,name:'云上远行',message:'两千米的足迹，都来自一次次练习。'}
  ];
  function landmark(height){
    if(height<=2000)return MILESTONES.find(function(m){return m.height>=height});
    return {height:Math.ceil(height/1000)*1000,name:'更高的远方',message:'又前进了一千米。保持自己的节奏。'};
  }
  function info(height){
    height=Math.max(0,height);
    var current=MILESTONES[0],next=MILESTONES[1];
    MILESTONES.forEach(function(m){if(height>=m.height)current=m;else if(next.height<=height)next=m});
    if(height>=2000){current={height:Math.floor(height/1000)*1000,name:'云上远行'};next=landmark(current.height+1000)}
    return {current:current,next:next,progress:Math.max(0,Math.min(1,(height-current.height)/(next.height-current.height)))};
  }
  function crossed(before,after){
    var end=info(after).current;
    return end.height>before?landmark(end.height):null;
  }
  function screenY(meters,cam){return -meters/METERS_PER_PIXEL-cam}
  function mix(a,b,t){return '#'+[0,2,4].map(function(i){return Math.round(parseInt(a.slice(i+1,i+3),16)*(1-t)+parseInt(b.slice(i+1,i+3),16)*t).toString(16).padStart(2,'0')}).join('')}
  function cloud(ctx,x,y,size,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#FFFDF3';ctx.beginPath();
    ctx.ellipse(x,y,56*size,15*size,0,0,Math.PI*2);
    ctx.ellipse(x-24*size,y-9*size,24*size,20*size,0,0,Math.PI*2);
    ctx.ellipse(x+3*size,y-18*size,29*size,26*size,0,0,Math.PI*2);
    ctx.ellipse(x+31*size,y-6*size,23*size,18*size,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(120,161,151,.16)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-35*size,y+9*size);ctx.quadraticCurveTo(x,y+22*size,x+43*size,y+6*size);ctx.stroke();ctx.restore();
  }
  function pine(ctx,x,y,s,color){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=color;
    ctx.fillRect(-1,-7,2,12);ctx.beginPath();ctx.moveTo(0,-44);ctx.lineTo(-10,-24);ctx.lineTo(-6,-25);ctx.lineTo(-16,-9);ctx.lineTo(-10,-11);ctx.lineTo(-20,2);ctx.quadraticCurveTo(0,10,20,2);ctx.lineTo(10,-11);ctx.lineTo(16,-9);ctx.lineTo(6,-25);ctx.lineTo(10,-24);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(248,247,224,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-34);ctx.lineTo(0,1);ctx.stroke();ctx.restore();
  }
  function mountains(ctx,v,climb){
    var w=v.w,h=v.h,y=h*.88+climb*.047,peak=y-h*.67;
    if(peak>h+100)return;
    // Broad curved shoulders and lit facets create a quiet illustrated valley.
    ctx.fillStyle='#B0CBC3';ctx.beginPath();ctx.moveTo(-30,y);ctx.bezierCurveTo(w*.07,y-h*.23,w*.14,peak+h*.12,w*.27,peak);ctx.bezierCurveTo(w*.32,peak+h*.04,w*.36,y-h*.35,w*.43,y-h*.24);ctx.bezierCurveTo(w*.52,y-h*.40,w*.58,peak+h*.08,w*.65,peak+h*.13);ctx.bezierCurveTo(w*.74,peak+h*.25,w*.80,y-h*.32,w*.86,y-h*.29);ctx.lineTo(w+30,y-h*.48);ctx.lineTo(w+30,h+100+climb*.047);ctx.lineTo(-30,h+100+climb*.047);ctx.closePath();ctx.fill();
    ctx.fillStyle='#98BDB1';ctx.beginPath();ctx.moveTo(w*.27,peak);ctx.bezierCurveTo(w*.31,peak+h*.2,w*.32,y-h*.24,w*.42,y);ctx.lineTo(w*.08,y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#EAF0DF';ctx.beginPath();ctx.moveTo(w*.27,peak);ctx.bezierCurveTo(w*.295,peak+h*.03,w*.32,peak+h*.09,w*.34,peak+h*.14);ctx.lineTo(w*.29,peak+h*.105);ctx.lineTo(w*.267,peak+h*.16);ctx.lineTo(w*.242,peak+h*.11);ctx.lineTo(w*.206,peak+h*.14);ctx.quadraticCurveTo(w*.24,peak+h*.025,w*.27,peak);ctx.fill();
    ctx.fillStyle='#DCE8D9';ctx.beginPath();ctx.moveTo(w*.65,peak+h*.13);ctx.lineTo(w*.715,peak+h*.24);ctx.lineTo(w*.66,peak+h*.22);ctx.lineTo(w*.625,peak+h*.27);ctx.lineTo(w*.60,peak+h*.22);ctx.closePath();ctx.fill();
    var near=h*.94+climb*.16;
    if(near-h*.48<h+100){
      ctx.fillStyle='#7CA58E';ctx.beginPath();ctx.moveTo(-30,h+180);ctx.lineTo(-30,near-h*.33);ctx.bezierCurveTo(w*.11,near-h*.43,w*.20,near-h*.08,w*.42,near);ctx.bezierCurveTo(w*.64,near+h*.04,w*.82,near-h*.37,w+30,near-h*.43);ctx.lineTo(w+30,h+180);ctx.closePath();ctx.fill();
      for(var i=0;i<14;i++){var px=i*w/13,edge=Math.abs(px/w-.46),py=near-h*(edge*.7+.02);pine(ctx,px,py,.44+edge*.55,'#638F79')}
    }
    var front=h*1.04+climb*.34;
    if(front-h*.30<h+100){
      ctx.fillStyle='#4E7D63';ctx.beginPath();ctx.moveTo(-20,h+180);ctx.lineTo(-20,front-h*.25);ctx.bezierCurveTo(w*.14,front-h*.28,w*.25,front+h*.03,w*.50,front+h*.04);ctx.bezierCurveTo(w*.76,front+h*.02,w*.86,front-h*.24,w+20,front-h*.18);ctx.lineTo(w+20,h+180);ctx.closePath();ctx.fill();
      for(var j=0;j<12;j++){var side=j<6?j/26:1-(j-6)/26,py2=front-h*(.25-side*.28);if(side>.5)py2=front-h*(.18-(1-side)*.1);pine(ctx,side*w,py2,.8+(j%3)*.15,'#426E58')}
    }
  }
  function distantIslands(ctx,v){
    // Each little garden belongs to one world height: it never follows the player.
    var first=Math.max(1,Math.floor(-v.cam*.42/560)-1),last=Math.ceil((-v.cam*.42+v.h)/560)+1;
    for(var i=first;i<=last;i++){
      var y=i*-560-v.cam*.42+160;if(y<-100||y>v.h+100)continue;
      var x=v.w*(i%2?.88:.14),s=v.w<620?.45:.72;
      ctx.save();ctx.globalAlpha=.45;ctx.translate(x,y);ctx.scale(s,s);
      ctx.fillStyle='#86AB99';ctx.beginPath();ctx.moveTo(-52,0);ctx.quadraticCurveTo(0,-15,52,0);ctx.lineTo(25,34);ctx.lineTo(-5,52);ctx.lineTo(-35,27);ctx.closePath();ctx.fill();ctx.fillStyle='#C2D4AA';ctx.beginPath();ctx.ellipse(0,0,52,10,0,0,Math.PI*2);ctx.fill();
      pine(ctx,-15,-4,.8,'#648D78');pine(ctx,14,-3,.55,'#749A7C');ctx.restore();
    }
  }
  function drawCamp(ctx,v){
    var y=screenY(0,v.cam)+34;
    if(y>v.h+190||y<-150)return;
    var x=v.w*.26;
    ctx.save();
    var ground=ctx.createLinearGradient(0,y-25,0,y+140);ground.addColorStop(0,'#6FA584');ground.addColorStop(1,'#315F59');
    ctx.fillStyle=ground;ctx.beginPath();ctx.moveTo(0,y+18);ctx.quadraticCurveTo(v.w*.23,y-52,v.w*.46,y+14);ctx.quadraticCurveTo(v.w*.74,y+52,v.w,y-14);ctx.lineTo(v.w,v.h+220);ctx.lineTo(0,v.h+220);ctx.closePath();ctx.fill();
    // A small ochre tent, a flag and trail: an unmistakable starting reference.
    ctx.fillStyle='#E8AF59';ctx.strokeStyle='#315F59';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x-43,y+3);ctx.lineTo(x-4,y-49);ctx.lineTo(x+41,y+3);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#FFF0CC';ctx.beginPath();ctx.moveTo(x-4,y-49);ctx.lineTo(x+41,y+3);ctx.lineTo(x+16,y+3);ctx.closePath();ctx.fill();
    ctx.fillStyle='#6A6954';ctx.beginPath();ctx.moveTo(x-4,y-24);ctx.lineTo(x-18,y+2);ctx.lineTo(x+12,y+2);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#315F59';ctx.beginPath();ctx.moveTo(x+63,y+4);ctx.lineTo(x+63,y-57);ctx.stroke();
    ctx.fillStyle='#D77960';ctx.beginPath();ctx.moveTo(x+63,y-57);ctx.lineTo(x+91,y-47);ctx.lineTo(x+63,y-37);ctx.closePath();ctx.fill();
    ctx.fillStyle='#FFF9EE';ctx.font='11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('出发营地 · 0 m',x+10,y+30);
    ctx.strokeStyle='rgba(255,249,238,.35)';ctx.lineWidth=7;ctx.setLineDash([3,14]);ctx.beginPath();ctx.moveTo(x+8,y+54);ctx.quadraticCurveTo(x+66,y+87,x+24,y+132);ctx.stroke();ctx.restore();
  }
  function drawRope(ctx,v){
    var x=v.w<620?18:48;
    ctx.save();ctx.strokeStyle='rgba(40,86,82,.38)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,-20);ctx.lineTo(x,v.h+20);ctx.stroke();
    ctx.strokeStyle='rgba(255,249,238,.72)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-1,-20);ctx.lineTo(x-1,v.h+20);ctx.stroke();
    // Knots use actual world positions. When idle they do not drift downward.
    var first=Math.floor(v.cam/42)-1,last=Math.ceil((v.cam+v.h)/42)+1;
    for(var knot=first;knot<=last;knot++){
      var ky=knot*42-v.cam;ctx.strokeStyle='rgba(41,89,83,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-4,ky);ctx.lineTo(x+4,ky+3);ctx.stroke();
    }
    var low=Math.max(0,Math.floor((-v.cam-v.h)*METERS_PER_PIXEL/50)*50),high=Math.ceil(-v.cam*METERS_PER_PIXEL/50)*50;
    for(var meter=low;meter<=high;meter+=50){
      var y=screenY(meter,v.cam);if(y<-32||y>v.h+30)continue;
      var major=meter===0||MILESTONES.some(function(m){return m.height===meter})||meter%1000===0;
      ctx.fillStyle=major?'#F3BD67':'#FFF9EE';ctx.strokeStyle='rgba(45,91,85,.38)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(x+10,y-12,major?72:59,24,5);ctx.fill();ctx.stroke();
      ctx.fillStyle='#294F4C';ctx.font='700 11px "Trebuchet MS",sans-serif';ctx.textAlign='center';ctx.fillText(meter+' m',x+10+(major?36:29.5),y+4);
      ctx.strokeStyle='#3E7368';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+10,y);ctx.stroke();
      if(major){ctx.fillStyle='#D77960';ctx.beginPath();ctx.moveTo(x-7,y-21);ctx.lineTo(x-26,y-27);ctx.lineTo(x-7,y-34);ctx.closePath();ctx.fill()}
    }
    ctx.restore();
  }
  function drawBackground(ctx,v,t){
    var phase=Math.min(1,v.altitude/1600),climb=Math.max(0,-v.cam-v.h*(v.anchor||.7));
    var sky=ctx.createLinearGradient(0,0,0,v.h);sky.addColorStop(0,mix('#A5CFCB','#79AEBB',phase));sky.addColorStop(.65,mix('#D6E5D5','#CEE1DC',phase));sky.addColorStop(1,'#F2ECCD');ctx.fillStyle=sky;ctx.fillRect(0,0,v.w,v.h);
    var sunX=v.w*.73,sunY=v.h*.22,halo=ctx.createRadialGradient(sunX,sunY,20,sunX,sunY,145);halo.addColorStop(0,'rgba(255,249,220,.85)');halo.addColorStop(1,'rgba(255,249,220,0)');ctx.fillStyle=halo;ctx.fillRect(sunX-145,sunY-145,290,290);ctx.fillStyle='#FFF4CB';ctx.beginPath();ctx.arc(sunX,sunY,34,0,Math.PI*2);ctx.fill();
    // Very subtle fixed flecks evoke printed paper, with no image dependency.
    ctx.fillStyle='rgba(52,89,74,.045)';for(var grain=0;grain<180;grain++){var gx=(grain*173.37)%v.w,gy=(grain*97.13)%v.h;ctx.fillRect(gx,gy,1,1)}
    mountains(ctx,v,climb);distantIslands(ctx,v);
    ctx.strokeStyle='rgba(62,103,87,.36)';ctx.lineWidth=1.4;
    for(var bird=0;bird<3;bird++){var bx=v.w*(.57+bird*.035),by=v.h*.23+bird*9+climb*.008;if(by>v.h)continue;ctx.beginPath();ctx.moveTo(bx-6,by);ctx.quadraticCurveTo(bx-2,by-4,bx,by);ctx.quadraticCurveTo(bx+3,by-4,bx+7,by-1);ctx.stroke()}
    // Clouds move horizontally with the breeze; their vertical motion comes from climbing.
    var camera=v.cam*.28,from=Math.floor((camera-130)/230),to=Math.ceil((camera+v.h+130)/230);
    for(var i=from;i<=to;i++){
      var seed=Math.sin(i*127.1+84.3)*.5+.5,cx=v.w*(.12+seed*.76)+Math.sin(t*.05+i)*12,cy=i*230-camera;
      cloud(ctx,cx,cy,v.w<620?.9:1.5,.48+seed*.18);
    }
    drawCamp(ctx,v);drawRope(ctx,v);
    if(v.altitude>450){
      var base=screenY(450,v.cam*.6)-140;
      // A fixed cloud bank is passed once; it is never reset around the viewport.
      if(base>-170&&base<v.h+170)for(var c=0;c<5;c++)cloud(ctx,c*v.w/4,base+Math.sin(c)*14,1.7,.25);
    }
  }
  function drawForeground(ctx,v){
    var fog=ctx.createLinearGradient(0,v.h*.88,0,v.h);fog.addColorStop(0,'rgba(250,247,237,0)');fog.addColorStop(1,'rgba(250,247,237,.36)');ctx.fillStyle=fog;ctx.fillRect(0,v.h*.88,v.w,v.h*.12);
  }
  return {METERS_PER_PIXEL:METERS_PER_PIXEL,milestones:MILESTONES,info:info,crossed:crossed,screenY:screenY,drawBackground:drawBackground,drawForeground:drawForeground};
});

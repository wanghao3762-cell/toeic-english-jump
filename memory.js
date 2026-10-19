/* Original code-native scene illustrations; no network image dependency. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ToeicMemory=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var titles={people:'人物与交流',office:'办公室',time:'日程与时间',document:'文件与信息',shopping:'购物与付款',delivery:'订单与配送',travel:'出行与预订',cafe:'餐饮与休息'};
  function scene(kind){
    var drawing={
      people:'<circle cx="112" cy="73" r="20" fill="#E4B18A"/><path d="M77 153v-29a35 35 0 0 1 70 0v29" fill="#72947C"/><circle cx="210" cy="91" r="16" fill="#E4B18A"/><path d="M181 153v-22a29 29 0 0 1 58 0v22" fill="#CBA366"/><path d="M148 42h100v37h-65l-19 14V79h-16Z" fill="#FFFCED"/><path d="M168 57h57m-57 9h38"/>',
      office:'<rect x="53" y="100" width="217" height="12" rx="4" fill="#C99B65"/><path d="M65 112v45m192-45v45"/><rect x="118" y="47" width="93" height="54" rx="5" fill="#72947C"/><rect x="126" y="55" width="77" height="36" rx="2" fill="#CDE1D1"/><path d="M164 101v9m-17 0h35"/><rect x="64" y="73" width="35" height="27" rx="3" fill="#F7F4E3"/><path d="M71 81h19m-19 7h15"/><path d="M239 100V64m-3 15q-18-22-21-7 0 12 21 15m4-18q18-21 21-4-1 10-21 13" fill="#7A9F70"/>',
      time:'<rect x="54" y="43" width="142" height="115" rx="8" fill="#FFFCED"/><path d="M54 71h142M83 32v22m84-22v22"/><path d="M77 92h20m16 0h20m16 0h20M77 113h20m16 0h20m16 0h20M77 134h20m16 0h20" stroke="#AFBA9E"/><circle cx="225" cy="119" r="41" fill="#EAD6AE"/><circle cx="225" cy="119" r="33" fill="#FFF9E9"/><path d="M225 95v25l17 11"/><circle cx="225" cy="119" r="3" fill="#D88457"/>',
      document:'<path d="M91 30h109l29 29v114H91Z" fill="#FFFCED"/><path d="M200 30v29h29M111 78h98m-98 17h98m-98 17h76m-76 17h40" stroke="#93AB95"/><path d="m64 132 62-27 39 36-65 28Z" fill="#DFC38E"/><path d="m64 132 53 15 9-42"/><path d="m202 151 38-55 11 8-38 56-14 7Z" fill="#D88457"/>',
      shopping:'<rect x="75" y="81" width="94" height="76" rx="5" fill="#D7B37A"/><path d="M96 81V64a26 26 0 0 1 52 0v17"/><path d="M192 48h49v112l-8-6-8 6-8-6-8 6-8-6-9 6Z" fill="#FFFCED"/><path d="M202 65h29m-29 15h29m-29 15h20m-20 28h29" stroke="#91A68C"/><circle cx="174" cy="144" r="20" fill="#E5C983"/><path d="M174 132v24m7-19h-10a5 5 0 0 0 0 10h5a5 5 0 0 1 0 10h-10"/>',
      delivery:'<path d="m66 87 73-35 76 35-76 37Z" fill="#E2BF85"/><path d="M66 87v64l73 32v-59Zm73 37 76-37v64l-76 32Z" fill="#CDA46D"/><path d="m102 69 77 37v35l-14-6v-35l-77-24" fill="#F2DEB7"/><path d="M225 73h39m-31 14h39m-31 14h22" stroke="#799773"/><rect x="82" y="114" width="31" height="20" fill="#FDF8E4"/>',
      travel:'<path d="m65 58 91 24 71-30 16 8-54 38 47 18-1 13-74-14-34 34-14-5 18-41-65-33Z" fill="#F8F7E8"/><path d="M71 155h189" stroke="#94AE94" stroke-dasharray="6 6"/><rect x="191" y="125" width="43" height="48" rx="6" fill="#C89B64"/><path d="M201 125v-12h22v12m-21 15v20m21-20v20"/><circle cx="201" cy="176" r="3" fill="#42634E"/><circle cx="225" cy="176" r="3" fill="#42634E"/>',
      cafe:'<ellipse cx="124" cy="150" rx="67" ry="10" fill="#B2C2A3"/><path d="M77 93h93l-8 51H85Z" fill="#FFFCED"/><path d="M170 102h13a16 16 0 0 1 0 31h-17m-69-54q-13-12 0-23m26 23q-13-12 0-23m26 23q-13-12 0-23"/><path d="m209 65 40 8-11 87-40-8Z" fill="#DCC18F"/><path d="m216 86 21 4m-24 12 21 4m-24 12 21 4"/>'
    };
    if(!drawing[kind])return '';
    return '<svg viewBox="0 0 320 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+titles[kind]+'场景示意"><rect width="320" height="210" rx="14" fill="#E8EDDC"/><circle cx="257" cy="44" r="25" fill="#F1DDAF"/><path d="M0 176q91-23 165 0t155-6v40H0Z" fill="#D5E0C7"/><g stroke="#45654F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">'+drawing[kind]+'</g></svg>';
  }
  function masked(sentence,word){return sentence.replace(new RegExp('(?<![a-z])'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![a-z])','gi'),'_____')}
  return {scene:scene,titles:titles,masked:masked};
});

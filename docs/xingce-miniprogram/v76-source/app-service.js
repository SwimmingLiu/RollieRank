	var __wxAppData = __wxAppData || {}; 	var __wxRoute = __wxRoute || ""; 	var __wxRouteBegin = __wxRouteBegin || ""; 	var __wxAppCode__ = __wxAppCode__ || {};	var global = global || {};	var __WXML_GLOBAL__=__WXML_GLOBAL__ || {};	var __wxAppCurrentFile__=__wxAppCurrentFile__||""; 	var Component = Component || function(){};	var definePlugin = definePlugin || function(){};	var requirePlugin = requirePlugin || function(){};	var Behavior = Behavior || function(){};	var __vd_version_info__ = __vd_version_info__ || {};
	/*v0.5vv_20211229_syb_scopedata*/global.__wcc_version__='v0.5vv_20211229_syb_scopedata';global.__wcc_version_info__={"customComponents":true,"fixZeroRpx":true,"propValueDeepCopy":false};
var $gwxc
var $gaic={}
$gwx=function(path,global){
if(typeof global === 'undefined') global={};if(typeof __WXML_GLOBAL__ === 'undefined') {__WXML_GLOBAL__={};
}__WXML_GLOBAL__.modules = __WXML_GLOBAL__.modules || {};
function _(a,b){if(typeof(b)!='undefined')a.children.push(b);}
function _v(k){if(typeof(k)!='undefined')return {tag:'virtual','wxKey':k,children:[]};return {tag:'virtual',children:[]};}
function _n(tag){return {tag:'wx-'+tag,attr:{},children:[],n:[],raw:{},generics:{}}}
function _p(a,b){b&&a.properities.push(b);}
function _s(scope,env,key){return typeof(scope[key])!='undefined'?scope[key]:env[key]}
function _wp(m){console.warn("WXMLRT_$gwx:"+m)}
function _wl(tname,prefix){_wp(prefix+':-1:-1:-1: Template `' + tname + '` is being called recursively, will be stop.')}
$gwn=console.warn;
$gwl=console.log;
function $gwh()
{
function x()
{
}
x.prototype = 
{
hn: function( obj, all )
{
if( typeof(obj) == 'object' )
{
var cnt=0;
var any1=false,any2=false;
for(var x in obj)
{
any1=any1|x==='__value__';
any2=any2|x==='__wxspec__';
cnt++;
if(cnt>2)break;
}
return cnt == 2 && any1 && any2 && ( all || obj.__wxspec__ !== 'm' || this.hn(obj.__value__) === 'h' ) ? "h" : "n";
}
return "n";
},
nh: function( obj, special )
{
return { __value__: obj, __wxspec__: special ? special : true }
},
rv: function( obj )
{
return this.hn(obj,true)==='n'?obj:this.rv(obj.__value__);
},
hm: function( obj )
{
if( typeof(obj) == 'object' )
{
var cnt=0;
var any1=false,any2=false;
for(var x in obj)
{
any1=any1|x==='__value__';
any2=any2|x==='__wxspec__';
cnt++;
if(cnt>2)break;
}
return cnt == 2 && any1 && any2 && (obj.__wxspec__ === 'm' || this.hm(obj.__value__) );
}
return false;
}
}
return new x;
}
wh=$gwh();
function $gstack(s){
var tmp=s.split('\n '+' '+' '+' ');
for(var i=0;i<tmp.length;++i){
if(0==i) continue;
if(")"===tmp[i][tmp[i].length-1])
tmp[i]=tmp[i].replace(/\s\(.*\)$/,"");
else
tmp[i]="at anonymous function";
}
return tmp.join('\n '+' '+' '+' ');
}
function $gwrt( should_pass_type_info )
{
function ArithmeticEv( ops, e, s, g, o )
{
var _f = false;
var rop = ops[0][1];
var _a,_b,_c,_d, _aa, _bb;
switch( rop )
{
case '?:':
_a = rev( ops[1], e, s, g, o, _f );
_c = should_pass_type_info && ( wh.hn(_a) === 'h' );
_d = wh.rv( _a ) ? rev( ops[2], e, s, g, o, _f ) : rev( ops[3], e, s, g, o, _f );
_d = _c && wh.hn( _d ) === 'n' ? wh.nh( _d, 'c' ) : _d;
return _d;
break;
case '&&':
_a = rev( ops[1], e, s, g, o, _f );
_c = should_pass_type_info && ( wh.hn(_a) === 'h' );
_d = wh.rv( _a ) ? rev( ops[2], e, s, g, o, _f ) : wh.rv( _a );
_d = _c && wh.hn( _d ) === 'n' ? wh.nh( _d, 'c' ) : _d;
return _d;
break;
case '||':
_a = rev( ops[1], e, s, g, o, _f );
_c = should_pass_type_info && ( wh.hn(_a) === 'h' );
_d = wh.rv( _a ) ? wh.rv(_a) : rev( ops[2], e, s, g, o, _f );
_d = _c && wh.hn( _d ) === 'n' ? wh.nh( _d, 'c' ) : _d;
return _d;
break;
case '+':
case '*':
case '/':
case '%':
case '|':
case '^':
case '&':
case '===':
case '==':
case '!=':
case '!==':
case '>=':
case '<=':
case '>':
case '<':
case '<<':
case '>>':
_a = rev( ops[1], e, s, g, o, _f );
_b = rev( ops[2], e, s, g, o, _f );
_c = should_pass_type_info && (wh.hn( _a ) === 'h' || wh.hn( _b ) === 'h');
switch( rop )
{
case '+':
_d = wh.rv( _a ) + wh.rv( _b );
break;
case '*':
_d = wh.rv( _a ) * wh.rv( _b );
break;
case '/':
_d = wh.rv( _a ) / wh.rv( _b );
break;
case '%':
_d = wh.rv( _a ) % wh.rv( _b );
break;
case '|':
_d = wh.rv( _a ) | wh.rv( _b );
break;
case '^':
_d = wh.rv( _a ) ^ wh.rv( _b );
break;
case '&':
_d = wh.rv( _a ) & wh.rv( _b );
break;
case '===':
_d = wh.rv( _a ) === wh.rv( _b );
break;
case '==':
_d = wh.rv( _a ) == wh.rv( _b );
break;
case '!=':
_d = wh.rv( _a ) != wh.rv( _b );
break;
case '!==':
_d = wh.rv( _a ) !== wh.rv( _b );
break;
case '>=':
_d = wh.rv( _a ) >= wh.rv( _b );
break;
case '<=':
_d = wh.rv( _a ) <= wh.rv( _b );
break;
case '>':
_d = wh.rv( _a ) > wh.rv( _b );
break;
case '<':
_d = wh.rv( _a ) < wh.rv( _b );
break;
case '<<':
_d = wh.rv( _a ) << wh.rv( _b );
break;
case '>>':
_d = wh.rv( _a ) >> wh.rv( _b );
break;
default:
break;
}
return _c ? wh.nh( _d, "c" ) : _d;
break;
case '-':
_a = ops.length === 3 ? rev( ops[1], e, s, g, o, _f ) : 0;
_b = ops.length === 3 ? rev( ops[2], e, s, g, o, _f ) : rev( ops[1], e, s, g, o, _f );
_c = should_pass_type_info && (wh.hn( _a ) === 'h' || wh.hn( _b ) === 'h');
_d = _c ? wh.rv( _a ) - wh.rv( _b ) : _a - _b;
return _c ? wh.nh( _d, "c" ) : _d;
break;
case '!':
_a = rev( ops[1], e, s, g, o, _f );
_c = should_pass_type_info && (wh.hn( _a ) == 'h');
_d = !wh.rv(_a);
return _c ? wh.nh( _d, "c" ) : _d;
case '~':
_a = rev( ops[1], e, s, g, o, _f );
_c = should_pass_type_info && (wh.hn( _a ) == 'h');
_d = ~wh.rv(_a);
return _c ? wh.nh( _d, "c" ) : _d;
default:
$gwn('unrecognized op' + rop );
}
}
function rev( ops, e, s, g, o, newap )
{
var op = ops[0];
var _f = false;
if ( typeof newap !== "undefined" ) o.ap = newap;
if( typeof(op)==='object' )
{
var vop=op[0];
var _a, _aa, _b, _bb, _c, _d, _s, _e, _ta, _tb, _td;
switch(vop)
{
case 2:
return ArithmeticEv(ops,e,s,g,o);
break;
case 4: 
return rev( ops[1], e, s, g, o, _f );
break;
case 5: 
switch( ops.length )
{
case 2: 
_a = rev( ops[1],e,s,g,o,_f );
return should_pass_type_info?[_a]:[wh.rv(_a)];
return [_a];
break;
case 1: 
return [];
break;
default:
_a = rev( ops[1],e,s,g,o,_f );
_b = rev( ops[2],e,s,g,o,_f );
_a.push( 
should_pass_type_info ?
_b :
wh.rv( _b )
);
return _a;
break;
}
break;
case 6:
_a = rev(ops[1],e,s,g,o);
var ap = o.ap;
_ta = wh.hn(_a)==='h';
_aa = _ta ? wh.rv(_a) : _a;
o.is_affected |= _ta;
if( should_pass_type_info )
{
if( _aa===null || typeof(_aa) === 'undefined' )
{
return _ta ? wh.nh(undefined, 'e') : undefined;
}
_b = rev(ops[2],e,s,g,o,_f);
_tb = wh.hn(_b) === 'h';
_bb = _tb ? wh.rv(_b) : _b;
o.ap = ap;
o.is_affected |= _tb;
if( _bb===null || typeof(_bb) === 'undefined' || 
_bb === "__proto__" || _bb === "prototype" || _bb === "caller" ) 
{
return (_ta || _tb) ? wh.nh(undefined, 'e') : undefined;
}
_d = _aa[_bb];
if ( typeof _d === 'function' && !ap ) _d = undefined;
_td = wh.hn(_d)==='h';
o.is_affected |= _td;
return (_ta || _tb) ? (_td ? _d : wh.nh(_d, 'e')) : _d;
}
else
{
if( _aa===null || typeof(_aa) === 'undefined' )
{
return undefined;
}
_b = rev(ops[2],e,s,g,o,_f);
_tb = wh.hn(_b) === 'h';
_bb = _tb ? wh.rv(_b) : _b;
o.ap = ap;
o.is_affected |= _tb;
if( _bb===null || typeof(_bb) === 'undefined' || 
_bb === "__proto__" || _bb === "prototype" || _bb === "caller" ) 
{
return undefined;
}
_d = _aa[_bb];
if ( typeof _d === 'function' && !ap ) _d = undefined;
_td = wh.hn(_d)==='h';
o.is_affected |= _td;
return _td ? wh.rv(_d) : _d;
}
case 7: 
switch(ops[1][0])
{
case 11:
o.is_affected |= wh.hn(g)==='h';
return g;
case 3:
_s = wh.rv( s );
_e = wh.rv( e );
_b = ops[1][1];
if (g && g.f && g.f.hasOwnProperty(_b) )
{
_a = g.f;
o.ap = true;
}
else
{
_a = _s && _s.hasOwnProperty(_b) ? 
s : (_e && _e.hasOwnProperty(_b) ? e : undefined );
}
if( should_pass_type_info )
{
if( _a )
{
_ta = wh.hn(_a) === 'h';
_aa = _ta ? wh.rv( _a ) : _a;
_d = _aa[_b];
_td = wh.hn(_d) === 'h';
o.is_affected |= _ta || _td;
_d = _ta && !_td ? wh.nh(_d,'e') : _d;
return _d;
}
}
else
{
if( _a )
{
_ta = wh.hn(_a) === 'h';
_aa = _ta ? wh.rv( _a ) : _a;
_d = _aa[_b];
_td = wh.hn(_d) === 'h';
o.is_affected |= _ta || _td;
return wh.rv(_d);
}
}
return undefined;
}
break;
case 8: 
_a = {};
_a[ops[1]] = rev(ops[2],e,s,g,o,_f);
return _a;
break;
case 9: 
_a = rev(ops[1],e,s,g,o,_f);
_b = rev(ops[2],e,s,g,o,_f);
function merge( _a, _b, _ow )
{
var ka, _bbk;
_ta = wh.hn(_a)==='h';
_tb = wh.hn(_b)==='h';
_aa = wh.rv(_a);
_bb = wh.rv(_b);
for(var k in _bb)
{
if ( _ow || !_aa.hasOwnProperty(k) )
{
_aa[k] = should_pass_type_info ? (_tb ? wh.nh(_bb[k],'e') : _bb[k]) : wh.rv(_bb[k]);
}
}
return _a;
}
var _c = _a
var _ow = true
if ( typeof(ops[1][0]) === "object" && ops[1][0][0] === 10 ) {
_a = _b
_b = _c
_ow = false
}
if ( typeof(ops[1][0]) === "object" && ops[1][0][0] === 10 ) {
var _r = {}
return merge( merge( _r, _a, _ow ), _b, _ow );
}
else
return merge( _a, _b, _ow );
break;
case 10:
_a = rev(ops[1],e,s,g,o,_f);
_a = should_pass_type_info ? _a : wh.rv( _a );
return _a ;
break;
case 12:
var _r;
_a = rev(ops[1],e,s,g,o);
if ( !o.ap )
{
return should_pass_type_info && wh.hn(_a)==='h' ? wh.nh( _r, 'f' ) : _r;
}
var ap = o.ap;
_b = rev(ops[2],e,s,g,o,_f);
o.ap = ap;
_ta = wh.hn(_a)==='h';
_tb = _ca(_b);
_aa = wh.rv(_a);	
_bb = wh.rv(_b); snap_bb=$gdc(_bb,"nv_");
try{
_r = typeof _aa === "function" ? $gdc(_aa.apply(null, snap_bb)) : undefined;
} catch (e){
e.message = e.message.replace(/nv_/g,"");
e.stack = e.stack.substring(0,e.stack.indexOf("\n", e.stack.lastIndexOf("at nv_")));
e.stack = e.stack.replace(/\snv_/g," "); 
e.stack = $gstack(e.stack);	
if(g.debugInfo)
{
e.stack += "\n "+" "+" "+" at "+g.debugInfo[0]+":"+g.debugInfo[1]+":"+g.debugInfo[2];
console.error(e);
}
_r = undefined;
}
return should_pass_type_info && (_tb || _ta) ? wh.nh( _r, 'f' ) : _r;
}
}
else
{
if( op === 3 || op === 1) return ops[1];
else if( op === 11 ) 
{
var _a='';
for( var i = 1 ; i < ops.length ; i++ )
{
var xp = wh.rv(rev(ops[i],e,s,g,o,_f));
_a += typeof(xp) === 'undefined' ? '' : xp;
}
return _a;
}
}
}
function wrapper( ops, e, s, g, o, newap )
{
if( ops[0] == '11182016' )
{
g.debugInfo = ops[2];
return rev( ops[1], e, s, g, o, newap );
}
else
{
g.debugInfo = null;
return rev( ops, e, s, g, o, newap );
}
}
return wrapper;
}
gra=$gwrt(true); 
grb=$gwrt(false); 
function TestTest( expr, ops, e,s,g, expect_a, expect_b, expect_affected )
{
{
var o = {is_affected:false};
var a = gra( ops, e,s,g, o );
if( JSON.stringify(a) != JSON.stringify( expect_a )
|| o.is_affected != expect_affected )
{
console.warn( "A. " + expr + " get result " + JSON.stringify(a) + ", " + o.is_affected + ", but " + JSON.stringify( expect_a ) + ", " + expect_affected + " is expected" );
}
}
{
var o = {is_affected:false};
var a = grb( ops, e,s,g, o );
if( JSON.stringify(a) != JSON.stringify( expect_b )
|| o.is_affected != expect_affected )
{
console.warn( "B. " + expr + " get result " + JSON.stringify(a) + ", " + o.is_affected + ", but " + JSON.stringify( expect_b ) + ", " + expect_affected + " is expected" );
}
}
}

function wfor( to_iter, func, env, _s, global, father, itemname, indexname, keyname )
{
var _n = wh.hn( to_iter ) === 'n'; 
var scope = wh.rv( _s ); 
var has_old_item = scope.hasOwnProperty(itemname);
var has_old_index = scope.hasOwnProperty(indexname);
var old_item = scope[itemname];
var old_index = scope[indexname];
var full = Object.prototype.toString.call(wh.rv(to_iter));
var type = full[8]; 
if( type === 'N' && full[10] === 'l' ) type = 'X'; 
var _y;
if( _n )
{
if( type === 'A' ) 
{
var r_iter_item;
for( var i = 0 ; i < to_iter.length ; i++ )
{
scope[itemname] = to_iter[i];
scope[indexname] = _n ? i : wh.nh(i, 'h');
r_iter_item = wh.rv(to_iter[i]);
var key = keyname && r_iter_item ? (keyname==="*this" ? r_iter_item : wh.rv(r_iter_item[keyname])) : undefined;
_y = _v(key);
_(father,_y);
func( env, scope, _y, global );
}
}
else if( type === 'O' ) 
{
var i = 0;
var r_iter_item;
for( var k in to_iter )
{
scope[itemname] = to_iter[k];
scope[indexname] = _n ? k : wh.nh(k, 'h');
r_iter_item = wh.rv(to_iter[k]);
var key = keyname && r_iter_item ? (keyname==="*this" ? r_iter_item : wh.rv(r_iter_item[keyname])) : undefined;
_y = _v(key);
_(father,_y);
func( env,scope,_y,global );
i++;
}
}
else if( type === 'S' ) 
{
for( var i = 0 ; i < to_iter.length ; i++ )
{
scope[itemname] = to_iter[i];
scope[indexname] = _n ? i : wh.nh(i, 'h');
_y = _v( to_iter[i] + i );
_(father,_y);
func( env,scope,_y,global );
}
}
else if( type === 'N' ) 
{
for( var i = 0 ; i < to_iter ; i++ )
{
scope[itemname] = i;
scope[indexname] = _n ? i : wh.nh(i, 'h');
_y = _v( i );
_(father,_y);
func(env,scope,_y,global);
}
}
else
{
}
}
else
{
var r_to_iter = wh.rv(to_iter);
var r_iter_item, iter_item;
if( type === 'A' ) 
{
for( var i = 0 ; i < r_to_iter.length ; i++ )
{
iter_item = r_to_iter[i];
iter_item = wh.hn(iter_item)==='n' ? wh.nh(iter_item,'h') : iter_item;
r_iter_item = wh.rv( iter_item );
scope[itemname] = iter_item
scope[indexname] = _n ? i : wh.nh(i, 'h');
var key = keyname && r_iter_item ? (keyname==="*this" ? r_iter_item : wh.rv(r_iter_item[keyname])) : undefined;
_y = _v(key);
_(father,_y);
func( env, scope, _y, global );
}
}
else if( type === 'O' ) 
{
var i=0;
for( var k in r_to_iter )
{
iter_item = r_to_iter[k];
iter_item = wh.hn(iter_item)==='n'? wh.nh(iter_item,'h') : iter_item;
r_iter_item = wh.rv( iter_item );
scope[itemname] = iter_item;
scope[indexname] = _n ? k : wh.nh(k, 'h');
var key = keyname && r_iter_item ? (keyname==="*this" ? r_iter_item : wh.rv(r_iter_item[keyname])) : undefined;
_y=_v(key);
_(father,_y);
func( env, scope, _y, global );
i++
}
}
else if( type === 'S' ) 
{
for( var i = 0 ; i < r_to_iter.length ; i++ )
{
iter_item = wh.nh(r_to_iter[i],'h');
scope[itemname] = iter_item;
scope[indexname] = _n ? i : wh.nh(i, 'h');
_y = _v( to_iter[i] + i );
_(father,_y);
func( env, scope, _y, global );
}
}
else if( type === 'N' ) 
{
for( var i = 0 ; i < r_to_iter ; i++ )
{
iter_item = wh.nh(i,'h');
scope[itemname] = iter_item;
scope[indexname]= _n ? i : wh.nh(i,'h');
_y = _v( i );
_(father,_y);
func(env,scope,_y,global);
}
}
else
{
}
}
if(has_old_item)
{
scope[itemname]=old_item;
}
else
{
delete scope[itemname];
}
if(has_old_index)
{
scope[indexname]=old_index;
}
else
{
delete scope[indexname];
}
}

function _ca(o)
{ 
if ( wh.hn(o) == 'h' ) return true;
if ( typeof o !== "object" ) return false;
for(var i in o){ 
if ( o.hasOwnProperty(i) ){
if (_ca(o[i])) return true;
}
}
return false;
}
function _da( node, attrname, opindex, raw, o )
{
var isaffected = false;
var value = $gdc( raw, "", 2 );
if ( o.ap && value && value.constructor===Function ) 
{
attrname = "$wxs:" + attrname; 
node.attr["$gdc"] = $gdc;
}
if ( o.is_affected || _ca(raw) ) 
{
node.n.push( attrname );
node.raw[attrname] = raw;
}
node.attr[attrname] = value;
}
function _r( node, attrname, opindex, env, scope, global ) 
{
global.opindex=opindex;
var o = {}, _env;
var a = grb( z[opindex], env, scope, global, o );
_da( node, attrname, opindex, a, o );
}
function _rz( z, node, attrname, opindex, env, scope, global ) 
{
global.opindex=opindex;
var o = {}, _env;
var a = grb( z[opindex], env, scope, global, o );
_da( node, attrname, opindex, a, o );
}
function _o( opindex, env, scope, global )
{
global.opindex=opindex;
var nothing = {};
var r = grb( z[opindex], env, scope, global, nothing );
return (r&&r.constructor===Function) ? undefined : r;
}
function _oz( z, opindex, env, scope, global )
{
global.opindex=opindex;
var nothing = {};
var r = grb( z[opindex], env, scope, global, nothing );
return (r&&r.constructor===Function) ? undefined : r;
}
function _1( opindex, env, scope, global, o )
{
var o = o || {};
global.opindex=opindex;
return gra( z[opindex], env, scope, global, o );
}
function _1z( z, opindex, env, scope, global, o )
{
var o = o || {};
global.opindex=opindex;
return gra( z[opindex], env, scope, global, o );
}
function _2( opindex, func, env, scope, global, father, itemname, indexname, keyname )
{
var o = {};
var to_iter = _1( opindex, env, scope, global );
wfor( to_iter, func, env, scope, global, father, itemname, indexname, keyname );
}
function _2z( z, opindex, func, env, scope, global, father, itemname, indexname, keyname )
{
var o = {};
var to_iter = _1z( z, opindex, env, scope, global );
wfor( to_iter, func, env, scope, global, father, itemname, indexname, keyname );
}


function _m(tag,attrs,generics,env,scope,global)
{
var tmp=_n(tag);
var base=0;
for(var i = 0 ; i < attrs.length ; i+=2 )
{
if(base+attrs[i+1]<0)
{
tmp.attr[attrs[i]]=true;
}
else
{
_r(tmp,attrs[i],base+attrs[i+1],env,scope,global);
if(base===0)base=attrs[i+1];
}
}
for(var i=0;i<generics.length;i+=2)
{
if(base+generics[i+1]<0)
{
tmp.generics[generics[i]]="";
}
else
{
var $t=grb(z[base+generics[i+1]],env,scope,global);
if ($t!="") $t="wx-"+$t;
tmp.generics[generics[i]]=$t;
if(base===0)base=generics[i+1];
}
}
return tmp;
}
function _mz(z,tag,attrs,generics,env,scope,global)
{
var tmp=_n(tag);
var base=0;
for(var i = 0 ; i < attrs.length ; i+=2 )
{
if(base+attrs[i+1]<0)
{
tmp.attr[attrs[i]]=true;
}
else
{
_rz(z, tmp,attrs[i],base+attrs[i+1],env,scope,global);
if(base===0)base=attrs[i+1];
}
}
for(var i=0;i<generics.length;i+=2)
{
if(base+generics[i+1]<0)
{
tmp.generics[generics[i]]="";
}
else
{
var $t=grb(z[base+generics[i+1]],env,scope,global);
if ($t!="") $t="wx-"+$t;
tmp.generics[generics[i]]=$t;
if(base===0)base=generics[i+1];
}
}
return tmp;
}

var nf_init=function(){
if(typeof __WXML_GLOBAL__==="undefined"||undefined===__WXML_GLOBAL__.wxs_nf_init){
nf_init_Object();nf_init_Function();nf_init_Array();nf_init_String();nf_init_Boolean();nf_init_Number();nf_init_Math();nf_init_Date();nf_init_RegExp();
}
if(typeof __WXML_GLOBAL__!=="undefined") __WXML_GLOBAL__.wxs_nf_init=true;
};
var nf_init_Object=function(){
Object.defineProperty(Object.prototype,"nv_constructor",{writable:true,value:"Object"})
Object.defineProperty(Object.prototype,"nv_toString",{writable:true,value:function(){return "[object Object]"}})
}
var nf_init_Function=function(){
Object.defineProperty(Function.prototype,"nv_constructor",{writable:true,value:"Function"})
Object.defineProperty(Function.prototype,"nv_length",{get:function(){return this.length;},set:function(){}});
Object.defineProperty(Function.prototype,"nv_toString",{writable:true,value:function(){return "[function Function]"}})
}
var nf_init_Array=function(){
Object.defineProperty(Array.prototype,"nv_toString",{writable:true,value:function(){return this.nv_join();}})
Object.defineProperty(Array.prototype,"nv_join",{writable:true,value:function(s){
s=undefined==s?',':s;
var r="";
for(var i=0;i<this.length;++i){
if(0!=i) r+=s;
if(null==this[i]||undefined==this[i]) r+='';	
else if(typeof this[i]=='function') r+=this[i].nv_toString();
else if(typeof this[i]=='object'&&this[i].nv_constructor==="Array") r+=this[i].nv_join();
else r+=this[i].toString();
}
return r;
}})
Object.defineProperty(Array.prototype,"nv_constructor",{writable:true,value:"Array"})
Object.defineProperty(Array.prototype,"nv_concat",{writable:true,value:Array.prototype.concat})
Object.defineProperty(Array.prototype,"nv_pop",{writable:true,value:Array.prototype.pop})
Object.defineProperty(Array.prototype,"nv_push",{writable:true,value:Array.prototype.push})
Object.defineProperty(Array.prototype,"nv_reverse",{writable:true,value:Array.prototype.reverse})
Object.defineProperty(Array.prototype,"nv_shift",{writable:true,value:Array.prototype.shift})
Object.defineProperty(Array.prototype,"nv_slice",{writable:true,value:Array.prototype.slice})
Object.defineProperty(Array.prototype,"nv_sort",{writable:true,value:Array.prototype.sort})
Object.defineProperty(Array.prototype,"nv_splice",{writable:true,value:Array.prototype.splice})
Object.defineProperty(Array.prototype,"nv_unshift",{writable:true,value:Array.prototype.unshift})
Object.defineProperty(Array.prototype,"nv_indexOf",{writable:true,value:Array.prototype.indexOf})
Object.defineProperty(Array.prototype,"nv_lastIndexOf",{writable:true,value:Array.prototype.lastIndexOf})
Object.defineProperty(Array.prototype,"nv_every",{writable:true,value:Array.prototype.every})
Object.defineProperty(Array.prototype,"nv_some",{writable:true,value:Array.prototype.some})
Object.defineProperty(Array.prototype,"nv_forEach",{writable:true,value:Array.prototype.forEach})
Object.defineProperty(Array.prototype,"nv_map",{writable:true,value:Array.prototype.map})
Object.defineProperty(Array.prototype,"nv_filter",{writable:true,value:Array.prototype.filter})
Object.defineProperty(Array.prototype,"nv_reduce",{writable:true,value:Array.prototype.reduce})
Object.defineProperty(Array.prototype,"nv_reduceRight",{writable:true,value:Array.prototype.reduceRight})
Object.defineProperty(Array.prototype,"nv_length",{get:function(){return this.length;},set:function(value){this.length=value;}});
}
var nf_init_String=function(){
Object.defineProperty(String.prototype,"nv_constructor",{writable:true,value:"String"})
Object.defineProperty(String.prototype,"nv_toString",{writable:true,value:String.prototype.toString})
Object.defineProperty(String.prototype,"nv_valueOf",{writable:true,value:String.prototype.valueOf})
Object.defineProperty(String.prototype,"nv_charAt",{writable:true,value:String.prototype.charAt})
Object.defineProperty(String.prototype,"nv_charCodeAt",{writable:true,value:String.prototype.charCodeAt})
Object.defineProperty(String.prototype,"nv_concat",{writable:true,value:String.prototype.concat})
Object.defineProperty(String.prototype,"nv_indexOf",{writable:true,value:String.prototype.indexOf})
Object.defineProperty(String.prototype,"nv_lastIndexOf",{writable:true,value:String.prototype.lastIndexOf})
Object.defineProperty(String.prototype,"nv_localeCompare",{writable:true,value:String.prototype.localeCompare})
Object.defineProperty(String.prototype,"nv_match",{writable:true,value:String.prototype.match})
Object.defineProperty(String.prototype,"nv_replace",{writable:true,value:String.prototype.replace})
Object.defineProperty(String.prototype,"nv_search",{writable:true,value:String.prototype.search})
Object.defineProperty(String.prototype,"nv_slice",{writable:true,value:String.prototype.slice})
Object.defineProperty(String.prototype,"nv_split",{writable:true,value:String.prototype.split})
Object.defineProperty(String.prototype,"nv_substring",{writable:true,value:String.prototype.substring})
Object.defineProperty(String.prototype,"nv_toLowerCase",{writable:true,value:String.prototype.toLowerCase})
Object.defineProperty(String.prototype,"nv_toLocaleLowerCase",{writable:true,value:String.prototype.toLocaleLowerCase})
Object.defineProperty(String.prototype,"nv_toUpperCase",{writable:true,value:String.prototype.toUpperCase})
Object.defineProperty(String.prototype,"nv_toLocaleUpperCase",{writable:true,value:String.prototype.toLocaleUpperCase})
Object.defineProperty(String.prototype,"nv_trim",{writable:true,value:String.prototype.trim})
Object.defineProperty(String.prototype,"nv_length",{get:function(){return this.length;},set:function(value){this.length=value;}});
}
var nf_init_Boolean=function(){
Object.defineProperty(Boolean.prototype,"nv_constructor",{writable:true,value:"Boolean"})
Object.defineProperty(Boolean.prototype,"nv_toString",{writable:true,value:Boolean.prototype.toString})
Object.defineProperty(Boolean.prototype,"nv_valueOf",{writable:true,value:Boolean.prototype.valueOf})
}
var nf_init_Number=function(){
Object.defineProperty(Number,"nv_MAX_VALUE",{writable:false,value:Number.MAX_VALUE})
Object.defineProperty(Number,"nv_MIN_VALUE",{writable:false,value:Number.MIN_VALUE})
Object.defineProperty(Number,"nv_NEGATIVE_INFINITY",{writable:false,value:Number.NEGATIVE_INFINITY})
Object.defineProperty(Number,"nv_POSITIVE_INFINITY",{writable:false,value:Number.POSITIVE_INFINITY})
Object.defineProperty(Number.prototype,"nv_constructor",{writable:true,value:"Number"})
Object.defineProperty(Number.prototype,"nv_toString",{writable:true,value:Number.prototype.toString})
Object.defineProperty(Number.prototype,"nv_toLocaleString",{writable:true,value:Number.prototype.toLocaleString})
Object.defineProperty(Number.prototype,"nv_valueOf",{writable:true,value:Number.prototype.valueOf})
Object.defineProperty(Number.prototype,"nv_toFixed",{writable:true,value:Number.prototype.toFixed})
Object.defineProperty(Number.prototype,"nv_toExponential",{writable:true,value:Number.prototype.toExponential})
Object.defineProperty(Number.prototype,"nv_toPrecision",{writable:true,value:Number.prototype.toPrecision})
}
var nf_init_Math=function(){
Object.defineProperty(Math,"nv_E",{writable:false,value:Math.E})
Object.defineProperty(Math,"nv_LN10",{writable:false,value:Math.LN10})
Object.defineProperty(Math,"nv_LN2",{writable:false,value:Math.LN2})
Object.defineProperty(Math,"nv_LOG2E",{writable:false,value:Math.LOG2E})
Object.defineProperty(Math,"nv_LOG10E",{writable:false,value:Math.LOG10E})
Object.defineProperty(Math,"nv_PI",{writable:false,value:Math.PI})
Object.defineProperty(Math,"nv_SQRT1_2",{writable:false,value:Math.SQRT1_2})
Object.defineProperty(Math,"nv_SQRT2",{writable:false,value:Math.SQRT2})
Object.defineProperty(Math,"nv_abs",{writable:false,value:Math.abs})
Object.defineProperty(Math,"nv_acos",{writable:false,value:Math.acos})
Object.defineProperty(Math,"nv_asin",{writable:false,value:Math.asin})
Object.defineProperty(Math,"nv_atan",{writable:false,value:Math.atan})
Object.defineProperty(Math,"nv_atan2",{writable:false,value:Math.atan2})
Object.defineProperty(Math,"nv_ceil",{writable:false,value:Math.ceil})
Object.defineProperty(Math,"nv_cos",{writable:false,value:Math.cos})
Object.defineProperty(Math,"nv_exp",{writable:false,value:Math.exp})
Object.defineProperty(Math,"nv_floor",{writable:false,value:Math.floor})
Object.defineProperty(Math,"nv_log",{writable:false,value:Math.log})
Object.defineProperty(Math,"nv_max",{writable:false,value:Math.max})
Object.defineProperty(Math,"nv_min",{writable:false,value:Math.min})
Object.defineProperty(Math,"nv_pow",{writable:false,value:Math.pow})
Object.defineProperty(Math,"nv_random",{writable:false,value:Math.random})
Object.defineProperty(Math,"nv_round",{writable:false,value:Math.round})
Object.defineProperty(Math,"nv_sin",{writable:false,value:Math.sin})
Object.defineProperty(Math,"nv_sqrt",{writable:false,value:Math.sqrt})
Object.defineProperty(Math,"nv_tan",{writable:false,value:Math.tan})
}
var nf_init_Date=function(){
Object.defineProperty(Date.prototype,"nv_constructor",{writable:true,value:"Date"})
Object.defineProperty(Date,"nv_parse",{writable:true,value:Date.parse})
Object.defineProperty(Date,"nv_UTC",{writable:true,value:Date.UTC})
Object.defineProperty(Date,"nv_now",{writable:true,value:Date.now})
Object.defineProperty(Date.prototype,"nv_toString",{writable:true,value:Date.prototype.toString})
Object.defineProperty(Date.prototype,"nv_toDateString",{writable:true,value:Date.prototype.toDateString})
Object.defineProperty(Date.prototype,"nv_toTimeString",{writable:true,value:Date.prototype.toTimeString})
Object.defineProperty(Date.prototype,"nv_toLocaleString",{writable:true,value:Date.prototype.toLocaleString})
Object.defineProperty(Date.prototype,"nv_toLocaleDateString",{writable:true,value:Date.prototype.toLocaleDateString})
Object.defineProperty(Date.prototype,"nv_toLocaleTimeString",{writable:true,value:Date.prototype.toLocaleTimeString})
Object.defineProperty(Date.prototype,"nv_valueOf",{writable:true,value:Date.prototype.valueOf})
Object.defineProperty(Date.prototype,"nv_getTime",{writable:true,value:Date.prototype.getTime})
Object.defineProperty(Date.prototype,"nv_getFullYear",{writable:true,value:Date.prototype.getFullYear})
Object.defineProperty(Date.prototype,"nv_getUTCFullYear",{writable:true,value:Date.prototype.getUTCFullYear})
Object.defineProperty(Date.prototype,"nv_getMonth",{writable:true,value:Date.prototype.getMonth})
Object.defineProperty(Date.prototype,"nv_getUTCMonth",{writable:true,value:Date.prototype.getUTCMonth})
Object.defineProperty(Date.prototype,"nv_getDate",{writable:true,value:Date.prototype.getDate})
Object.defineProperty(Date.prototype,"nv_getUTCDate",{writable:true,value:Date.prototype.getUTCDate})
Object.defineProperty(Date.prototype,"nv_getDay",{writable:true,value:Date.prototype.getDay})
Object.defineProperty(Date.prototype,"nv_getUTCDay",{writable:true,value:Date.prototype.getUTCDay})
Object.defineProperty(Date.prototype,"nv_getHours",{writable:true,value:Date.prototype.getHours})
Object.defineProperty(Date.prototype,"nv_getUTCHours",{writable:true,value:Date.prototype.getUTCHours})
Object.defineProperty(Date.prototype,"nv_getMinutes",{writable:true,value:Date.prototype.getMinutes})
Object.defineProperty(Date.prototype,"nv_getUTCMinutes",{writable:true,value:Date.prototype.getUTCMinutes})
Object.defineProperty(Date.prototype,"nv_getSeconds",{writable:true,value:Date.prototype.getSeconds})
Object.defineProperty(Date.prototype,"nv_getUTCSeconds",{writable:true,value:Date.prototype.getUTCSeconds})
Object.defineProperty(Date.prototype,"nv_getMilliseconds",{writable:true,value:Date.prototype.getMilliseconds})
Object.defineProperty(Date.prototype,"nv_getUTCMilliseconds",{writable:true,value:Date.prototype.getUTCMilliseconds})
Object.defineProperty(Date.prototype,"nv_getTimezoneOffset",{writable:true,value:Date.prototype.getTimezoneOffset})
Object.defineProperty(Date.prototype,"nv_setTime",{writable:true,value:Date.prototype.setTime})
Object.defineProperty(Date.prototype,"nv_setMilliseconds",{writable:true,value:Date.prototype.setMilliseconds})
Object.defineProperty(Date.prototype,"nv_setUTCMilliseconds",{writable:true,value:Date.prototype.setUTCMilliseconds})
Object.defineProperty(Date.prototype,"nv_setSeconds",{writable:true,value:Date.prototype.setSeconds})
Object.defineProperty(Date.prototype,"nv_setUTCSeconds",{writable:true,value:Date.prototype.setUTCSeconds})
Object.defineProperty(Date.prototype,"nv_setMinutes",{writable:true,value:Date.prototype.setMinutes})
Object.defineProperty(Date.prototype,"nv_setUTCMinutes",{writable:true,value:Date.prototype.setUTCMinutes})
Object.defineProperty(Date.prototype,"nv_setHours",{writable:true,value:Date.prototype.setHours})
Object.defineProperty(Date.prototype,"nv_setUTCHours",{writable:true,value:Date.prototype.setUTCHours})
Object.defineProperty(Date.prototype,"nv_setDate",{writable:true,value:Date.prototype.setDate})
Object.defineProperty(Date.prototype,"nv_setUTCDate",{writable:true,value:Date.prototype.setUTCDate})
Object.defineProperty(Date.prototype,"nv_setMonth",{writable:true,value:Date.prototype.setMonth})
Object.defineProperty(Date.prototype,"nv_setUTCMonth",{writable:true,value:Date.prototype.setUTCMonth})
Object.defineProperty(Date.prototype,"nv_setFullYear",{writable:true,value:Date.prototype.setFullYear})
Object.defineProperty(Date.prototype,"nv_setUTCFullYear",{writable:true,value:Date.prototype.setUTCFullYear})
Object.defineProperty(Date.prototype,"nv_toUTCString",{writable:true,value:Date.prototype.toUTCString})
Object.defineProperty(Date.prototype,"nv_toISOString",{writable:true,value:Date.prototype.toISOString})
Object.defineProperty(Date.prototype,"nv_toJSON",{writable:true,value:Date.prototype.toJSON})
}
var nf_init_RegExp=function(){
Object.defineProperty(RegExp.prototype,"nv_constructor",{writable:true,value:"RegExp"})
Object.defineProperty(RegExp.prototype,"nv_exec",{writable:true,value:RegExp.prototype.exec})
Object.defineProperty(RegExp.prototype,"nv_test",{writable:true,value:RegExp.prototype.test})
Object.defineProperty(RegExp.prototype,"nv_toString",{writable:true,value:RegExp.prototype.toString})
Object.defineProperty(RegExp.prototype,"nv_source",{get:function(){return this.source;},set:function(){}});
Object.defineProperty(RegExp.prototype,"nv_global",{get:function(){return this.global;},set:function(){}});
Object.defineProperty(RegExp.prototype,"nv_ignoreCase",{get:function(){return this.ignoreCase;},set:function(){}});
Object.defineProperty(RegExp.prototype,"nv_multiline",{get:function(){return this.multiline;},set:function(){}});
Object.defineProperty(RegExp.prototype,"nv_lastIndex",{get:function(){return this.lastIndex;},set:function(v){this.lastIndex=v;}});
}
nf_init();
var nv_getDate=function(){var args=Array.prototype.slice.call(arguments);args.unshift(Date);return new(Function.prototype.bind.apply(Date, args));}
var nv_getRegExp=function(){var args=Array.prototype.slice.call(arguments);args.unshift(RegExp);return new(Function.prototype.bind.apply(RegExp, args));}
var nv_console={}
nv_console.nv_log=function(){var res="WXSRT:";for(var i=0;i<arguments.length;++i)res+=arguments[i]+" ";console.log(res);}
var nv_parseInt = parseInt, nv_parseFloat = parseFloat, nv_isNaN = isNaN, nv_isFinite = isFinite, nv_decodeURI = decodeURI, nv_decodeURIComponent = decodeURIComponent, nv_encodeURI = encodeURI, nv_encodeURIComponent = encodeURIComponent;
function $gdc(o,p,r) {
o=wh.rv(o);
if(o===null||o===undefined) return o;
if(typeof o==="string"||typeof o==="boolean"||typeof o==="number") return o;
if(o.constructor===Object){
var copy={};
for(var k in o)
if(Object.prototype.hasOwnProperty.call(o,k))
if(undefined===p) copy[k.substring(3)]=$gdc(o[k],p,r);
else copy[p+k]=$gdc(o[k],p,r);
return copy;
}
if(o.constructor===Array){
var copy=[];
for(var i=0;i<o.length;i++) copy.push($gdc(o[i],p,r));
return copy;
}
if(o.constructor===Date){
var copy=new Date();
copy.setTime(o.getTime());
return copy;
}
if(o.constructor===RegExp){
var f="";
if(o.global) f+="g";
if(o.ignoreCase) f+="i";
if(o.multiline) f+="m";
return (new RegExp(o.source,f));
}
if(r&&typeof o==="function"){
if ( r == 1 ) return $gdc(o(),undefined, 2);
if ( r == 2 ) return o;
}
return null;
}
var nv_JSON={}
nv_JSON.nv_stringify=function(o){
JSON.stringify(o);
return JSON.stringify($gdc(o));
}
nv_JSON.nv_parse=function(o){
if(o===undefined) return undefined;
var t=JSON.parse(o);
return $gdc(t,'nv_');
}

function _af(p, a, r, c){
p.extraAttr = {"t_action": a, "t_rawid": r };
if ( typeof(c) != 'undefined' ) p.extraAttr.t_cid = c;
}

function _ai(i,p,e,me,r,c){var x=_grp(p,e,me);if(x)i.push(x);else{i.push('');_wp(me+':import:'+r+':'+c+': Path `'+p+'` not found from `'+me+'`.')}}
function _grp(p,e,me){if(p[0]!='/'){var mepart=me.split('/');mepart.pop();var ppart=p.split('/');for(var i=0;i<ppart.length;i++){if( ppart[i]=='..')mepart.pop();else if(!ppart[i]||ppart[i]=='.')continue;else mepart.push(ppart[i]);}p=mepart.join('/');}if(me[0]=='.'&&p[0]=='/')p='.'+p;if(e[p])return p;if(e[p+'.wxml'])return p+'.wxml';}
function _gd(p,c,e,d){if(!c)return;if(d[p][c])return d[p][c];for(var x=e[p].i.length-1;x>=0;x--){if(e[p].i[x]&&d[e[p].i[x]][c])return d[e[p].i[x]][c]};for(var x=e[p].ti.length-1;x>=0;x--){var q=_grp(e[p].ti[x],e,p);if(q&&d[q][c])return d[q][c]}var ii=_gapi(e,p);for(var x=0;x<ii.length;x++){if(ii[x]&&d[ii[x]][c])return d[ii[x]][c]}for(var k=e[p].j.length-1;k>=0;k--)if(e[p].j[k]){for(var q=e[e[p].j[k]].ti.length-1;q>=0;q--){var pp=_grp(e[e[p].j[k]].ti[q],e,p);if(pp&&d[pp][c]){return d[pp][c]}}}}
function _gapi(e,p){if(!p)return [];if($gaic[p]){return $gaic[p]};var ret=[],q=[],h=0,t=0,put={},visited={};q.push(p);visited[p]=true;t++;while(h<t){var a=q[h++];for(var i=0;i<e[a].ic.length;i++){var nd=e[a].ic[i];var np=_grp(nd,e,a);if(np&&!visited[np]){visited[np]=true;q.push(np);t++;}}for(var i=0;a!=p&&i<e[a].ti.length;i++){var ni=e[a].ti[i];var nm=_grp(ni,e,a);if(nm&&!put[nm]){put[nm]=true;ret.push(nm);}}}$gaic[p]=ret;return ret;}
var $ixc={};function _ic(p,ent,me,e,s,r,gg){var x=_grp(p,ent,me);ent[me].j.push(x);if(x){if($ixc[x]){_wp('-1:include:-1:-1: `'+p+'` is being included in a loop, will be stop.');return;}$ixc[x]=true;try{ent[x].f(e,s,r,gg)}catch(e){}$ixc[x]=false;}else{_wp(me+':include:-1:-1: Included path `'+p+'` not found from `'+me+'`.')}}
function _w(tn,f,line,c){_wp(f+':template:'+line+':'+c+': Template `'+tn+'` not found.');}function _ev(dom){var changed=false;delete dom.properities;delete dom.n;if(dom.children){do{changed=false;var newch = [];for(var i=0;i<dom.children.length;i++){var ch=dom.children[i];if( ch.tag=='virtual'){changed=true;for(var j=0;ch.children&&j<ch.children.length;j++){newch.push(ch.children[j]);}}else { newch.push(ch); } } dom.children = newch; }while(changed);for(var i=0;i<dom.children.length;i++){_ev(dom.children[i]);}} return dom; }
function _tsd( root )
{
if( root.tag == "wx-wx-scope" ) 
{
root.tag = "virtual";
root.wxCkey = "11";
root['wxScopeData'] = root.attr['wx:scope-data'];
delete root.n;
delete root.raw;
delete root.generics;
delete root.attr;
}
for( var i = 0 ; root.children && i < root.children.length ; i++ )
{
_tsd( root.children[i] );
}
return root;
}

var e_={}
if(typeof(global.entrys)==='undefined')global.entrys={};e_=global.entrys;
var d_={}
if(typeof(global.defines)==='undefined')global.defines={};d_=global.defines;
var f_={}
if(typeof(global.modules)==='undefined')global.modules={};f_=global.modules || {};
var p_={}
__WXML_GLOBAL__.ops_cached = __WXML_GLOBAL__.ops_cached || {}
__WXML_GLOBAL__.ops_set = __WXML_GLOBAL__.ops_set || {};
__WXML_GLOBAL__.ops_init = __WXML_GLOBAL__.ops_init || {};
var z=__WXML_GLOBAL__.ops_set.$gwx || [];
function gz$gwx_1(){
if( __WXML_GLOBAL__.ops_cached.$gwx_1)return __WXML_GLOBAL__.ops_cached.$gwx_1
__WXML_GLOBAL__.ops_cached.$gwx_1=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([a,[3,'ranking-container '],[[2,'?:'],[[2,'==='],[[7],[3,'theme']],[1,'card']],[1,'card-theme'],[1,'plain-theme']]])
Z([[2,'>'],[[6],[[7],[3,'list']],[3,'length']],[1,0]])
Z([[7],[3,'list']])
Z([3,'rank'])
Z([[2,'||'],[[2,'||'],[[2,'!'],[[7],[3,'limit']]],[[2,'<'],[[7],[3,'index']],[[7],[3,'limit']]]],[[7],[3,'showFullLeaderboard']]])
Z([[2,'||'],[[6],[[7],[3,'item']],[3,'isMe']],[[2,'&&'],[[2,'&&'],[[7],[3,'currentUserProfile']],[[6],[[7],[3,'currentUserProfile']],[3,'userId']]],[[2,'==='],[[6],[[7],[3,'item']],[3,'userId']],[[6],[[7],[3,'currentUserProfile']],[3,'userId']]]]])
Z([[7],[3,'loading']])
Z([[2,'!'],[[7],[3,'loadError']]])
Z([[2,'&&'],[[7],[3,'loadError']],[[2,'!'],[[7],[3,'loading']]]])
Z([[2,'&&'],[[7],[3,'limit']],[[2,'>'],[[6],[[7],[3,'list']],[3,'length']],[[7],[3,'limit']]]])
Z([[7],[3,'showDetailModal']])
Z([3,'onCloseDetailModal'])
Z([3,'modal-mask'])
Z([3,'noop'])
Z([3,'modal-content result-card'])
Z([3,'detail-sections-scroll'])
Z([[7],[3,'detailLoading']])
Z([[7],[3,'detailError']])
Z([[2,'&&'],[[6],[[7],[3,'selectedUser']],[3,'sectionStats']],[[2,'>'],[[6],[[6],[[7],[3,'selectedUser']],[3,'sectionStats']],[3,'length']],[1,0]]])
Z([[7],[3,'detailNotice']])
Z([[2,'&&'],[[6],[[7],[3,'selectedUser']],[3,'sectionResults']],[[2,'>'],[[6],[[6],[[7],[3,'selectedUser']],[3,'sectionResults']],[3,'length']],[1,0]]])
Z([[7],[3,'showLoginModal']])
})(__WXML_GLOBAL__.ops_cached.$gwx_1);return __WXML_GLOBAL__.ops_cached.$gwx_1
}
function gz$gwx_2(){
if( __WXML_GLOBAL__.ops_cached.$gwx_2)return __WXML_GLOBAL__.ops_cached.$gwx_2
__WXML_GLOBAL__.ops_cached.$gwx_2=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'report-list'])
Z([[7],[3,'reports']])
Z([3,'_id'])
Z([3,'report-card'])
Z([[6],[[7],[3,'item']],[3,'subTitle']])
Z([[6],[[7],[3,'item']],[3,'contact']])
Z([[2,'&&'],[[2,'==='],[[6],[[7],[3,'reports']],[3,'length']],[1,0]],[[2,'!'],[[7],[3,'loading']]]])
Z([[7],[3,'loading']])
Z([[2,'&&'],[[2,'!'],[[7],[3,'hasMore']]],[[2,'>'],[[6],[[7],[3,'reports']],[3,'length']],[1,0]]])
})(__WXML_GLOBAL__.ops_cached.$gwx_2);return __WXML_GLOBAL__.ops_cached.$gwx_2
}
function gz$gwx_3(){
if( __WXML_GLOBAL__.ops_cached.$gwx_3)return __WXML_GLOBAL__.ops_cached.$gwx_3
__WXML_GLOBAL__.ops_cached.$gwx_3=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'container'])
Z([[7],[3,'scanStage']])
Z([3,'continuous-screen'])
Z([[2,'!=='],[[6],[[7],[3,'scanner']],[3,'captureMode']],[1,'continuous']])
Z([3,'continuous-camera-box'])
Z([[6],[[7],[3,'scanner']],[3,'cameraBoxStyle']])
Z([[6],[[7],[3,'scanner']],[3,'photoPreview']])
Z([[2,'!'],[[6],[[7],[3,'scanner']],[3,'photoPreview']]])
Z([[2,'&&'],[[2,'==='],[[6],[[7],[3,'scanner']],[3,'captureMode']],[1,'continuous']],[[2,'||'],[[2,'||'],[[2,'==='],[[6],[[7],[3,'scanner']],[3,'phase']],[1,'scanning']],[[2,'==='],[[6],[[7],[3,'scanner']],[3,'phase']],[1,'capturing']]],[[2,'==='],[[6],[[7],[3,'scanner']],[3,'phase']],[1,'photoProcessing']]]])
Z([[6],[[7],[3,'scanner']],[3,'rawError']])
Z([[6],[[7],[3,'scanner']],[3,'permissionNeeded']])
Z([[2,'==='],[[6],[[7],[3,'scanner']],[3,'captureMode']],[1,'continuous']])
Z([[7],[3,'scanMessage']])
Z([[6],[[7],[3,'scanner']],[3,'privacyVisible']])
Z([[2,'&&'],[[2,'!'],[[7],[3,'scanStage']]],[[2,'||'],[[7],[3,'scanMessage']],[[6],[[7],[3,'reviewQuestions']],[3,'length']]]])
Z([[6],[[7],[3,'reviewQuestions']],[3,'length']])
Z([[2,'&&'],[[2,'!'],[[7],[3,'scanStage']]],[[2,'!=='],[[7],[3,'mode']],[1,'grid']]])
Z([[2,'&&'],[[2,'!'],[[7],[3,'scanStage']]],[[2,'==='],[[7],[3,'mode']],[1,'grid']]])
Z([[2,'==='],[[7],[3,'entryMode']],[1,'scan']])
Z([[7],[3,'scanAdError']])
Z([[7],[3,'editQuestion']])
Z([[2,'&&'],[[2,'!'],[[7],[3,'scanStage']]],[[2,'==='],[[7],[3,'mode']],[1,'list']]])
Z([3,'section-container'])
Z([3,'q'])
Z([[7],[3,'currentQuestions']])
Z([3,'id'])
Z([a,[3,'question-card '],[[2,'?:'],[[6],[[7],[3,'reviewMap']],[[6],[[7],[3,'q']],[3,'id']]],[1,'scan-review'],[1,'']]])
Z([[6],[[7],[3,'reviewMap']],[[6],[[7],[3,'q']],[3,'id']]])
Z(z[27])
Z([3,'section-nav'])
Z([[2,'>'],[[7],[3,'currentSectionIndex']],[1,0]])
Z([[2,'<'],[[7],[3,'currentSectionIndex']],[[2,'-'],[[6],[[7],[3,'structure']],[3,'length']],[1,1]]])
Z([[2,'&&'],[[2,'!'],[[7],[3,'scanStage']]],[[2,'==='],[[7],[3,'mode']],[1,'single']]])
Z([3,'single-container'])
Z([3,'onSwiperChange'])
Z([1,false])
Z([3,'question-swiper'])
Z([[7],[3,'swiperCurrent']])
Z([3,'200'])
Z([3,'item'])
Z([[7],[3,'allQuestions']])
Z(z[25])
Z([[6],[[7],[3,'reviewMap']],[[6],[[7],[3,'item']],[3,'id']]])
Z([[7],[3,'isSheetVisible']])
})(__WXML_GLOBAL__.ops_cached.$gwx_3);return __WXML_GLOBAL__.ops_cached.$gwx_3
}
function gz$gwx_4(){
if( __WXML_GLOBAL__.ops_cached.$gwx_4)return __WXML_GLOBAL__.ops_cached.$gwx_4
__WXML_GLOBAL__.ops_cached.$gwx_4=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
})(__WXML_GLOBAL__.ops_cached.$gwx_4);return __WXML_GLOBAL__.ops_cached.$gwx_4
}
function gz$gwx_5(){
if( __WXML_GLOBAL__.ops_cached.$gwx_5)return __WXML_GLOBAL__.ops_cached.$gwx_5
__WXML_GLOBAL__.ops_cached.$gwx_5=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'container'])
Z([[7],[3,'loading']])
Z([[7],[3,'error']])
Z([[2,'==='],[[7],[3,'mode']],[1,'html']])
Z([[2,'!'],[[6],[[7],[3,'paragraphs']],[3,'length']]])
})(__WXML_GLOBAL__.ops_cached.$gwx_5);return __WXML_GLOBAL__.ops_cached.$gwx_5
}
function gz$gwx_6(){
if( __WXML_GLOBAL__.ops_cached.$gwx_6)return __WXML_GLOBAL__.ops_cached.$gwx_6
__WXML_GLOBAL__.ops_cached.$gwx_6=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'main'])
Z([[7],[3,'loading']])
Z([[7],[3,'error']])
Z([3,'site'])
Z([[7],[3,'sites']])
Z([3,'key'])
Z([3,'examples'])
Z([[6],[[7],[3,'site']],[3,'note']])
Z([[2,'!'],[[6],[[6],[[7],[3,'site']],[3,'examples']],[3,'length']]])
})(__WXML_GLOBAL__.ops_cached.$gwx_6);return __WXML_GLOBAL__.ops_cached.$gwx_6
}
function gz$gwx_7(){
if( __WXML_GLOBAL__.ops_cached.$gwx_7)return __WXML_GLOBAL__.ops_cached.$gwx_7
__WXML_GLOBAL__.ops_cached.$gwx_7=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'onGlobalClick'])
Z([3,'container'])
Z([[7],[3,'questionBankEnabled']])
Z([[2,'==='],[[7],[3,'supportDeveloperEnabled']],[1,1]])
Z([[7],[3,'categories']])
Z([3,'id'])
Z([3,'onCategoryTap'])
Z([3,'practice-card'])
Z([[6],[[7],[3,'item']],[3,'id']])
Z([3,'practice-card-hover'])
Z([3,'100'])
Z([3,'card-left'])
Z([[2,'||'],[[2,'==='],[[6],[[7],[3,'item']],[3,'id']],[1,'peanut_26_guokao_2']],[[2,'==='],[[6],[[7],[3,'item']],[3,'id']],[1,'peanut_26_guokao_2_fusheng']]])
Z([[6],[[7],[3,'item']],[3,'desc']])
Z([[2,'==='],[[7],[3,'activeCategory']],[[6],[[7],[3,'item']],[3,'id']]])
Z([3,'period'])
Z([[7],[3,'periods']])
Z(z[5])
Z([3,'onToggleExamExpand'])
Z([3,'period-item'])
Z([[6],[[7],[3,'period']],[3,'examId']])
Z([3,'period-item-hover'])
Z([[6],[[7],[3,'period']],[3,'history']])
Z([[2,'||'],[[2,'||'],[[2,'||'],[[2,'==='],[[7],[3,'activeCategory']],[1,'peanut_26_shengkao_1']],[[2,'==='],[[7],[3,'activeCategory']],[1,'peanut_26_shengkao_2']]],[[2,'==='],[[7],[3,'activeCategory']],[1,'chaoge_26_shengkao']]],[[2,'==='],[[7],[3,'activeCategory']],[1,'chaoge_26_taojuan']]])
Z([3,'noop'])
Z([a,[3,'expand-container '],[[2,'?:'],[[6],[[7],[3,'expandedExams']],[[6],[[7],[3,'period']],[3,'examId']]],[1,'expanded'],[1,'']]])
Z([[6],[[7],[3,'expandedExams']],[[6],[[7],[3,'period']],[3,'examId']]])
Z([[6],[[7],[3,'period']],[3,'hasOnlineExam']])
Z([[2,'&&'],[[2,'&&'],[[2,'&&'],[[2,'!=='],[[7],[3,'activeCategory']],[1,'peanut_26_shengkao_1']],[[2,'!=='],[[7],[3,'activeCategory']],[1,'peanut_26_shengkao_2']]],[[2,'!=='],[[7],[3,'activeCategory']],[1,'chaoge_26_shengkao']]],[[2,'!=='],[[7],[3,'activeCategory']],[1,'chaoge_26_taojuan']]])
Z([[2,'||'],[[7],[3,'hasMoreCategories']],[[2,'>'],[[7],[3,'categoryLimit']],[1,3]]])
Z([3,'category-controls'])
Z([[7],[3,'hasMoreCategories']])
Z([[2,'>'],[[7],[3,'categoryLimit']],[1,3]])
Z([[2,'&&'],[[7],[3,'questionBankEnabled']],[[7],[3,'showAnswerChoice']]])
})(__WXML_GLOBAL__.ops_cached.$gwx_7);return __WXML_GLOBAL__.ops_cached.$gwx_7
}
function gz$gwx_8(){
if( __WXML_GLOBAL__.ops_cached.$gwx_8)return __WXML_GLOBAL__.ops_cached.$gwx_8
__WXML_GLOBAL__.ops_cached.$gwx_8=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
})(__WXML_GLOBAL__.ops_cached.$gwx_8);return __WXML_GLOBAL__.ops_cached.$gwx_8
}
function gz$gwx_9(){
if( __WXML_GLOBAL__.ops_cached.$gwx_9)return __WXML_GLOBAL__.ops_cached.$gwx_9
__WXML_GLOBAL__.ops_cached.$gwx_9=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
})(__WXML_GLOBAL__.ops_cached.$gwx_9);return __WXML_GLOBAL__.ops_cached.$gwx_9
}
function gz$gwx_10(){
if( __WXML_GLOBAL__.ops_cached.$gwx_10)return __WXML_GLOBAL__.ops_cached.$gwx_10
__WXML_GLOBAL__.ops_cached.$gwx_10=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([[7],[3,'showHistory']])
})(__WXML_GLOBAL__.ops_cached.$gwx_10);return __WXML_GLOBAL__.ops_cached.$gwx_10
}
function gz$gwx_11(){
if( __WXML_GLOBAL__.ops_cached.$gwx_11)return __WXML_GLOBAL__.ops_cached.$gwx_11
__WXML_GLOBAL__.ops_cached.$gwx_11=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
})(__WXML_GLOBAL__.ops_cached.$gwx_11);return __WXML_GLOBAL__.ops_cached.$gwx_11
}
function gz$gwx_12(){
if( __WXML_GLOBAL__.ops_cached.$gwx_12)return __WXML_GLOBAL__.ops_cached.$gwx_12
__WXML_GLOBAL__.ops_cached.$gwx_12=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'container'])
Z([[2,'&&'],[[2,'!=='],[[7],[3,'percent']],[1,undefined]],[[2,'!=='],[[7],[3,'percent']],[1,null]]])
Z([[2,'&&'],[[7],[3,'rank']],[[7],[3,'totalSubmissions']]])
Z([[2,'||'],[[2,'==='],[[7],[3,'saveStatus']],[1,'saving']],[[2,'==='],[[7],[3,'saveStatus']],[1,'error']]])
Z([[2,'==='],[[7],[3,'saveStatus']],[1,'error']])
Z([[7],[3,'detailsUnavailable']])
Z([3,'onProfileUpdate'])
Z([3,'retryRankingLoad'])
Z([[7],[3,'currentUserProfile']])
Z([[7],[3,'examId']])
Z([1,3])
Z([[7],[3,'leaderboardList']])
Z([[2,'||'],[[7],[3,'leaderboardLoadError']],[[7],[3,'rankLoadError']]])
Z([[7],[3,'leaderboardLoading']])
Z([3,'card'])
Z([[7],[3,'scoreRank']])
Z([[7],[3,'isAdvancedMode']])
Z([[7],[3,'sectionResults']])
Z([3,'name'])
Z([[2,'!'],[[6],[[7],[3,'sectionCollapsed']],[[6],[[7],[3,'item']],[3,'name']]]])
Z([[7],[3,'showReportModal']])
})(__WXML_GLOBAL__.ops_cached.$gwx_12);return __WXML_GLOBAL__.ops_cached.$gwx_12
}
function gz$gwx_13(){
if( __WXML_GLOBAL__.ops_cached.$gwx_13)return __WXML_GLOBAL__.ops_cached.$gwx_13
__WXML_GLOBAL__.ops_cached.$gwx_13=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'container'])
Z([[7],[3,'deleteError']])
Z([[2,'>'],[[6],[[7],[3,'historyList']],[3,'length']],[1,0]])
Z([[7],[3,'historyList']])
Z([3,'_id'])
Z([3,'onRecordTap'])
Z([3,'history-card'])
Z([[7],[3,'index']])
Z([[6],[[7],[3,'item']],[3,'percent']])
Z([[2,'&&'],[[2,'!'],[[7],[3,'loading']]],[[2,'==='],[[6],[[7],[3,'historyList']],[3,'length']],[1,0]]])
Z([3,'onProfileUpdate'])
Z([3,'retryRankingLoad'])
Z([[7],[3,'currentUserProfile']])
Z([[7],[3,'examId']])
Z([[7],[3,'leaderboardList']])
Z([[7],[3,'leaderboardLoadError']])
Z([[7],[3,'leaderboardLoading']])
Z([1,true])
Z([3,'plain'])
Z([3,'🏆 本套试卷英雄榜'])
})(__WXML_GLOBAL__.ops_cached.$gwx_13);return __WXML_GLOBAL__.ops_cached.$gwx_13
}
function gz$gwx_14(){
if( __WXML_GLOBAL__.ops_cached.$gwx_14)return __WXML_GLOBAL__.ops_cached.$gwx_14
__WXML_GLOBAL__.ops_cached.$gwx_14=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'records-page'])
Z([[2,'>'],[[6],[[7],[3,'drafts']],[3,'length']],[1,0]])
Z([[2,'>'],[[6],[[7],[3,'reports']],[3,'length']],[1,0]])
Z([[2,'&&'],[[2,'==='],[[6],[[7],[3,'drafts']],[3,'length']],[1,0]],[[2,'==='],[[6],[[7],[3,'reports']],[3,'length']],[1,0]]])
})(__WXML_GLOBAL__.ops_cached.$gwx_14);return __WXML_GLOBAL__.ops_cached.$gwx_14
}
function gz$gwx_15(){
if( __WXML_GLOBAL__.ops_cached.$gwx_15)return __WXML_GLOBAL__.ops_cached.$gwx_15
__WXML_GLOBAL__.ops_cached.$gwx_15=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([[7],[3,'localReportSaved']])
})(__WXML_GLOBAL__.ops_cached.$gwx_15);return __WXML_GLOBAL__.ops_cached.$gwx_15
}
function gz$gwx_16(){
if( __WXML_GLOBAL__.ops_cached.$gwx_16)return __WXML_GLOBAL__.ops_cached.$gwx_16
__WXML_GLOBAL__.ops_cached.$gwx_16=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'container'])
Z([[2,'>'],[[6],[[7],[3,'presets']],[3,'length']],[1,0]])
Z([[7],[3,'showLetterModal']])
Z([[7],[3,'showNameModal']])
Z([[7],[3,'showAddModal']])
})(__WXML_GLOBAL__.ops_cached.$gwx_16);return __WXML_GLOBAL__.ops_cached.$gwx_16
}
function gz$gwx_17(){
if( __WXML_GLOBAL__.ops_cached.$gwx_17)return __WXML_GLOBAL__.ops_cached.$gwx_17
__WXML_GLOBAL__.ops_cached.$gwx_17=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'onMainTap'])
Z([3,'timer-main'])
Z([[2,'!=='],[[7],[3,'timeDisplayMode']],[1,2]])
Z([a,[3,'timer-display '],[[2,'?:'],[[2,'==='],[[7],[3,'timeDisplayMode']],[1,2]],[1,'split-mode-display'],[1,'']]])
Z([[2,'==='],[[7],[3,'timeDisplayMode']],[1,0]])
Z([[2,'==='],[[7],[3,'timeDisplayMode']],[1,1]])
Z([[2,'==='],[[7],[3,'timeDisplayMode']],[1,2]])
})(__WXML_GLOBAL__.ops_cached.$gwx_17);return __WXML_GLOBAL__.ops_cached.$gwx_17
}
function gz$gwx_18(){
if( __WXML_GLOBAL__.ops_cached.$gwx_18)return __WXML_GLOBAL__.ops_cached.$gwx_18
__WXML_GLOBAL__.ops_cached.$gwx_18=[];
(function(z){var a=11;function Z(ops){z.push(ops)}
Z([3,'container'])
Z([[7],[3,'loading']])
Z([[2,'&&'],[[2,'!'],[[7],[3,'hasMore']]],[[2,'>'],[[6],[[7],[3,'users']],[3,'length']],[1,0]]])
Z([[2,'&&'],[[2,'!'],[[7],[3,'loading']]],[[2,'==='],[[6],[[7],[3,'users']],[3,'length']],[1,0]]])
})(__WXML_GLOBAL__.ops_cached.$gwx_18);return __WXML_GLOBAL__.ops_cached.$gwx_18
}
__WXML_GLOBAL__.ops_set.$gwx=z;
__WXML_GLOBAL__.ops_init.$gwx=true;
var nv_require=function(){var nnm={"m_./pages/math-tools/percentage/percentage.wxml:tools":np_0,"m_./pages/result/result.wxml:utils":np_1,};var nom={};return function(n){if(n[0]==='p'&&n[1]==='_'&&f_[n.slice(2)])return f_[n.slice(2)];return function(){if(!nnm[n]) return undefined;try{if(!nom[n])nom[n]=nnm[n]();return nom[n];}catch(e){e.message=e.message.replace(/nv_/g,'');var tmp = e.stack.substring(0,e.stack.lastIndexOf(n));e.stack = tmp.substring(0,tmp.lastIndexOf('\n'));e.stack = e.stack.replace(/\snv_/g,' ');e.stack = $gstack(e.stack);e.stack += '\n    at ' + n.substring(2);console.error(e);}
}}}()
f_['./pages/math-tools/percentage/percentage.wxml']={};
f_['./pages/math-tools/percentage/percentage.wxml']['tools'] =nv_require("m_./pages/math-tools/percentage/percentage.wxml:tools");
function np_0(){var nv_module={nv_exports:{}};nv_module.nv_exports.nv_toFixed = (function (nv_num){return(nv_num.nv_toFixed(0))});return nv_module.nv_exports;}

f_['./pages/result/result.wxml']={};
f_['./pages/result/result.wxml']['utils'] =nv_require("m_./pages/result/result.wxml:utils");
function np_1(){var nv_module={nv_exports:{}};var nv_getCount = (function (nv_stats,nv_qNum,nv_opt){var nv_key = 'q_' + nv_qNum;if (!nv_stats || !nv_stats[((nt_0=(nv_key),null==nt_0?undefined:'number'=== typeof nt_0?nt_0:"nv_"+nt_0))])return(0);;if (nv_stats[((nt_1=(nv_key),null==nt_1?undefined:'number'=== typeof nt_1?nt_1:"nv_"+nt_1))].nv_distCount && nv_stats[((nt_2=(nv_key),null==nt_2?undefined:'number'=== typeof nt_2?nt_2:"nv_"+nt_2))].nv_distCount[((nt_3=(nv_opt),null==nt_3?undefined:'number'=== typeof nt_3?nt_3:"nv_"+nt_3))] !== undefined){return(nv_stats[((nt_4=(nv_key),null==nt_4?undefined:'number'=== typeof nt_4?nt_4:"nv_"+nt_4))].nv_distCount[((nt_5=(nv_opt),null==nt_5?undefined:'number'=== typeof nt_5?nt_5:"nv_"+nt_5))])};var nv_total = nv_stats[((nt_6=(nv_key),null==nt_6?undefined:'number'=== typeof nt_6?nt_6:"nv_"+nt_6))].nv_count || 0;var nv_pct = (nv_stats[((nt_7=(nv_key),null==nt_7?undefined:'number'=== typeof nt_7?nt_7:"nv_"+nt_7))].nv_dist && nv_stats[((nt_8=(nv_key),null==nt_8?undefined:'number'=== typeof nt_8?nt_8:"nv_"+nt_8))].nv_dist[((nt_9=(nv_opt),null==nt_9?undefined:'number'=== typeof nt_9?nt_9:"nv_"+nt_9))]) || 0;return(Math.nv_round(nv_total * nv_pct / 100))});nv_module.nv_exports = ({nv_getCount:nv_getCount,});return nv_module.nv_exports;}

var x=['./components/hero-ranking/hero-ranking.wxml','./pages/admin/report-list/report-list.wxml','./pages/exam/exam.wxml','./pages/fb-tool/fb-tool.wxml','./pages/idiom-reader/idiom-reader.wxml','./pages/idiom/idiom.wxml','./pages/index/index.wxml','./pages/letter/letter.wxml','./pages/math-tools/menu/menu.wxml','./pages/math-tools/percentage/percentage.wxml','./pages/percentage-result/percentage-result.wxml','./pages/result/result.wxml','./pages/set-history/set-history.wxml','./pages/timer-records/timer-records.wxml','./pages/timer-report/timer-report.wxml','./pages/timer-setup/timer-setup.wxml','./pages/timer/timer.wxml','./pages/user-list/user-list.wxml'];d_[x[0]]={}
var m0=function(e,s,r,gg){
var z=gz$gwx_1()
var oB=_n('view')
_rz(z,oB,'class',0,e,s,gg)
var xC=_v()
_(oB,xC)
if(_oz(z,1,e,s,gg)){xC.wxVkey=1
var oH=_v()
_(xC,oH)
var cI=function(lK,oJ,aL,gg){
var eN=_v()
_(aL,eN)
if(_oz(z,4,lK,oJ,gg)){eN.wxVkey=1
var bO=_v()
_(eN,bO)
if(_oz(z,5,lK,oJ,gg)){bO.wxVkey=1
}
bO.wxXCkey=1
}
eN.wxXCkey=1
return aL
}
oH.wxXCkey=2
_2z(z,2,cI,e,s,gg,oH,'item','index','rank')
}
else if(_oz(z,6,e,s,gg)){xC.wxVkey=2
}
else if(_oz(z,7,e,s,gg)){xC.wxVkey=3
}
var oD=_v()
_(oB,oD)
if(_oz(z,8,e,s,gg)){oD.wxVkey=1
}
var fE=_v()
_(oB,fE)
if(_oz(z,9,e,s,gg)){fE.wxVkey=1
}
var cF=_v()
_(oB,cF)
if(_oz(z,10,e,s,gg)){cF.wxVkey=1
var oP=_mz(z,'view',['bindtap',11,'class',1],[],e,s,gg)
var xQ=_mz(z,'view',['catchtap',13,'class',1],[],e,s,gg)
var oR=_mz(z,'scroll-view',['scrollY',-1,'class',15],[],e,s,gg)
var fS=_v()
_(oR,fS)
if(_oz(z,16,e,s,gg)){fS.wxVkey=1
}
else if(_oz(z,17,e,s,gg)){fS.wxVkey=2
}
else if(_oz(z,18,e,s,gg)){fS.wxVkey=3
var cT=_v()
_(fS,cT)
if(_oz(z,19,e,s,gg)){cT.wxVkey=1
}
cT.wxXCkey=1
}
else if(_oz(z,20,e,s,gg)){fS.wxVkey=4
}
else{fS.wxVkey=5
}
fS.wxXCkey=1
_(xQ,oR)
_(oP,xQ)
_(cF,oP)
}
var hG=_v()
_(oB,hG)
if(_oz(z,21,e,s,gg)){hG.wxVkey=1
}
xC.wxXCkey=1
oD.wxXCkey=1
fE.wxXCkey=1
cF.wxXCkey=1
hG.wxXCkey=1
_(r,oB)
return r
}
e_[x[0]]={f:m0,j:[],i:[],ti:[],ic:[]}
d_[x[1]]={}
var m1=function(e,s,r,gg){
var z=gz$gwx_2()
var oV=_n('view')
_rz(z,oV,'class',0,e,s,gg)
var aZ=_v()
_(oV,aZ)
var t1=function(b3,e2,o4,gg){
var o6=_n('view')
_rz(z,o6,'class',3,b3,e2,gg)
var f7=_v()
_(o6,f7)
if(_oz(z,4,b3,e2,gg)){f7.wxVkey=1
}
var c8=_v()
_(o6,c8)
if(_oz(z,5,b3,e2,gg)){c8.wxVkey=1
}
f7.wxXCkey=1
c8.wxXCkey=1
_(o4,o6)
return o4
}
aZ.wxXCkey=2
_2z(z,1,t1,e,s,gg,aZ,'item','index','_id')
var cW=_v()
_(oV,cW)
if(_oz(z,6,e,s,gg)){cW.wxVkey=1
}
var oX=_v()
_(oV,oX)
if(_oz(z,7,e,s,gg)){oX.wxVkey=1
}
var lY=_v()
_(oV,lY)
if(_oz(z,8,e,s,gg)){lY.wxVkey=1
}
cW.wxXCkey=1
oX.wxXCkey=1
lY.wxXCkey=1
_(r,oV)
return r
}
e_[x[1]]={f:m1,j:[],i:[],ti:[],ic:[]}
d_[x[2]]={}
var m2=function(e,s,r,gg){
var z=gz$gwx_3()
var o0=_n('view')
_rz(z,o0,'class',0,e,s,gg)
var cAB=_v()
_(o0,cAB)
if(_oz(z,1,e,s,gg)){cAB.wxVkey=1
var oHB=_n('view')
_rz(z,oHB,'class',2,e,s,gg)
var xIB=_v()
_(oHB,xIB)
if(_oz(z,3,e,s,gg)){xIB.wxVkey=1
}
var oPB=_mz(z,'view',['class',4,'style',1],[],e,s,gg)
var lQB=_v()
_(oPB,lQB)
if(_oz(z,6,e,s,gg)){lQB.wxVkey=1
}
var aRB=_v()
_(oPB,aRB)
if(_oz(z,7,e,s,gg)){aRB.wxVkey=1
}
lQB.wxXCkey=1
aRB.wxXCkey=1
_(oHB,oPB)
var oJB=_v()
_(oHB,oJB)
if(_oz(z,8,e,s,gg)){oJB.wxVkey=1
}
var fKB=_v()
_(oHB,fKB)
if(_oz(z,9,e,s,gg)){fKB.wxVkey=1
}
var cLB=_v()
_(oHB,cLB)
if(_oz(z,10,e,s,gg)){cLB.wxVkey=1
}
var hMB=_v()
_(oHB,hMB)
if(_oz(z,11,e,s,gg)){hMB.wxVkey=1
}
var oNB=_v()
_(oHB,oNB)
if(_oz(z,12,e,s,gg)){oNB.wxVkey=1
}
var cOB=_v()
_(oHB,cOB)
if(_oz(z,13,e,s,gg)){cOB.wxVkey=1
}
xIB.wxXCkey=1
oJB.wxXCkey=1
fKB.wxXCkey=1
cLB.wxXCkey=1
hMB.wxXCkey=1
oNB.wxXCkey=1
cOB.wxXCkey=1
_(cAB,oHB)
}
var oBB=_v()
_(o0,oBB)
if(_oz(z,14,e,s,gg)){oBB.wxVkey=1
var tSB=_v()
_(oBB,tSB)
if(_oz(z,15,e,s,gg)){tSB.wxVkey=1
}
tSB.wxXCkey=1
}
var lCB=_v()
_(o0,lCB)
if(_oz(z,16,e,s,gg)){lCB.wxVkey=1
}
var aDB=_v()
_(o0,aDB)
if(_oz(z,17,e,s,gg)){aDB.wxVkey=1
var eTB=_v()
_(aDB,eTB)
if(_oz(z,18,e,s,gg)){eTB.wxVkey=1
}
var bUB=_v()
_(aDB,bUB)
if(_oz(z,19,e,s,gg)){bUB.wxVkey=1
}
eTB.wxXCkey=1
bUB.wxXCkey=1
}
var tEB=_v()
_(o0,tEB)
if(_oz(z,20,e,s,gg)){tEB.wxVkey=1
}
var eFB=_v()
_(o0,eFB)
if(_oz(z,21,e,s,gg)){eFB.wxVkey=1
var oVB=_n('view')
_rz(z,oVB,'class',22,e,s,gg)
var xWB=_v()
_(oVB,xWB)
var oXB=function(cZB,fYB,h1B,gg){
var c3B=_n('view')
_rz(z,c3B,'class',26,cZB,fYB,gg)
var o4B=_v()
_(c3B,o4B)
if(_oz(z,27,cZB,fYB,gg)){o4B.wxVkey=1
}
var l5B=_v()
_(c3B,l5B)
if(_oz(z,28,cZB,fYB,gg)){l5B.wxVkey=1
}
o4B.wxXCkey=1
l5B.wxXCkey=1
_(h1B,c3B)
return h1B
}
xWB.wxXCkey=2
_2z(z,24,oXB,e,s,gg,xWB,'q','index','id')
var a6B=_n('view')
_rz(z,a6B,'class',29,e,s,gg)
var t7B=_v()
_(a6B,t7B)
if(_oz(z,30,e,s,gg)){t7B.wxVkey=1
}
var e8B=_v()
_(a6B,e8B)
if(_oz(z,31,e,s,gg)){e8B.wxVkey=1
}
t7B.wxXCkey=1
e8B.wxXCkey=1
_(oVB,a6B)
_(eFB,oVB)
}
var bGB=_v()
_(o0,bGB)
if(_oz(z,32,e,s,gg)){bGB.wxVkey=1
var b9B=_n('view')
_rz(z,b9B,'class',33,e,s,gg)
var xAC=_mz(z,'swiper',['bindchange',34,'circular',1,'class',2,'current',3,'duration',4],[],e,s,gg)
var oBC=_v()
_(xAC,oBC)
var fCC=function(hEC,cDC,oFC,gg){
var oHC=_v()
_(oFC,oHC)
if(_oz(z,42,hEC,cDC,gg)){oHC.wxVkey=1
}
oHC.wxXCkey=1
return oFC
}
oBC.wxXCkey=2
_2z(z,40,fCC,e,s,gg,oBC,'item','index','id')
_(b9B,xAC)
var o0B=_v()
_(b9B,o0B)
if(_oz(z,43,e,s,gg)){o0B.wxVkey=1
}
o0B.wxXCkey=1
_(bGB,b9B)
}
cAB.wxXCkey=1
oBB.wxXCkey=1
lCB.wxXCkey=1
aDB.wxXCkey=1
tEB.wxXCkey=1
eFB.wxXCkey=1
bGB.wxXCkey=1
_(r,o0)
return r
}
e_[x[2]]={f:m2,j:[],i:[],ti:[],ic:[]}
d_[x[3]]={}
var m3=function(e,s,r,gg){
var z=gz$gwx_4()
return r
}
e_[x[3]]={f:m3,j:[],i:[],ti:[],ic:[]}
d_[x[4]]={}
var m4=function(e,s,r,gg){
var z=gz$gwx_5()
var tKC=_n('view')
_rz(z,tKC,'class',0,e,s,gg)
var eLC=_v()
_(tKC,eLC)
if(_oz(z,1,e,s,gg)){eLC.wxVkey=1
}
else if(_oz(z,2,e,s,gg)){eLC.wxVkey=2
}
else if(_oz(z,3,e,s,gg)){eLC.wxVkey=3
}
else{eLC.wxVkey=4
var bMC=_v()
_(eLC,bMC)
if(_oz(z,4,e,s,gg)){bMC.wxVkey=1
}
bMC.wxXCkey=1
}
eLC.wxXCkey=1
_(r,tKC)
return r
}
e_[x[4]]={f:m4,j:[],i:[],ti:[],ic:[]}
d_[x[5]]={}
var m5=function(e,s,r,gg){
var z=gz$gwx_6()
var xOC=_n('view')
_rz(z,xOC,'class',0,e,s,gg)
var oPC=_v()
_(xOC,oPC)
if(_oz(z,1,e,s,gg)){oPC.wxVkey=1
}
var fQC=_v()
_(xOC,fQC)
if(_oz(z,2,e,s,gg)){fQC.wxVkey=1
}
var cRC=_v()
_(xOC,cRC)
var hSC=function(cUC,oTC,oVC,gg){
var aXC=_n('view')
_rz(z,aXC,'class',6,cUC,oTC,gg)
var tYC=_v()
_(aXC,tYC)
if(_oz(z,7,cUC,oTC,gg)){tYC.wxVkey=1
}
var eZC=_v()
_(aXC,eZC)
if(_oz(z,8,cUC,oTC,gg)){eZC.wxVkey=1
}
tYC.wxXCkey=1
eZC.wxXCkey=1
_(oVC,aXC)
return oVC
}
cRC.wxXCkey=2
_2z(z,4,hSC,e,s,gg,cRC,'site','index','key')
oPC.wxXCkey=1
fQC.wxXCkey=1
_(r,xOC)
return r
}
e_[x[5]]={f:m5,j:[],i:[],ti:[],ic:[]}
d_[x[6]]={}
var m6=function(e,s,r,gg){
var z=gz$gwx_7()
var o2C=_mz(z,'view',['bindtap',0,'class',1],[],e,s,gg)
var x3C=_v()
_(o2C,x3C)
if(_oz(z,2,e,s,gg)){x3C.wxVkey=1
var f5C=_v()
_(x3C,f5C)
if(_oz(z,3,e,s,gg)){f5C.wxVkey=1
}
var h7C=_v()
_(x3C,h7C)
var o8C=function(o0C,c9C,lAD,gg){
var eDD=_mz(z,'view',['bindtap',6,'class',1,'data-id',2,'hoverClass',3,'hoverStayTime',4],[],o0C,c9C,gg)
var bED=_n('view')
_rz(z,bED,'class',11,o0C,c9C,gg)
var oFD=_v()
_(bED,oFD)
if(_oz(z,12,o0C,c9C,gg)){oFD.wxVkey=1
}
var xGD=_v()
_(bED,xGD)
if(_oz(z,13,o0C,c9C,gg)){xGD.wxVkey=1
}
oFD.wxXCkey=1
xGD.wxXCkey=1
_(eDD,bED)
_(lAD,eDD)
var tCD=_v()
_(lAD,tCD)
if(_oz(z,14,o0C,c9C,gg)){tCD.wxVkey=1
var oHD=_v()
_(tCD,oHD)
var fID=function(hKD,cJD,oLD,gg){
var oND=_mz(z,'view',['catchtap',18,'class',1,'data-id',2,'hoverClass',3],[],hKD,cJD,gg)
var lOD=_v()
_(oND,lOD)
if(_oz(z,22,hKD,cJD,gg)){lOD.wxVkey=1
}
var aPD=_v()
_(oND,aPD)
if(_oz(z,23,hKD,cJD,gg)){aPD.wxVkey=1
var eRD=_mz(z,'view',['catchtap',24,'class',1],[],hKD,cJD,gg)
var bSD=_v()
_(eRD,bSD)
if(_oz(z,26,hKD,cJD,gg)){bSD.wxVkey=1
var oTD=_v()
_(bSD,oTD)
if(_oz(z,27,hKD,cJD,gg)){oTD.wxVkey=1
}
oTD.wxXCkey=1
}
bSD.wxXCkey=1
_(aPD,eRD)
}
var tQD=_v()
_(oND,tQD)
if(_oz(z,28,hKD,cJD,gg)){tQD.wxVkey=1
}
lOD.wxXCkey=1
aPD.wxXCkey=1
tQD.wxXCkey=1
_(oLD,oND)
return oLD
}
oHD.wxXCkey=2
_2z(z,16,fID,o0C,c9C,gg,oHD,'period','index','id')
}
tCD.wxXCkey=1
return lAD
}
h7C.wxXCkey=2
_2z(z,4,o8C,e,s,gg,h7C,'item','index','id')
var c6C=_v()
_(x3C,c6C)
if(_oz(z,29,e,s,gg)){c6C.wxVkey=1
var xUD=_n('view')
_rz(z,xUD,'class',30,e,s,gg)
var oVD=_v()
_(xUD,oVD)
if(_oz(z,31,e,s,gg)){oVD.wxVkey=1
}
var fWD=_v()
_(xUD,fWD)
if(_oz(z,32,e,s,gg)){fWD.wxVkey=1
}
oVD.wxXCkey=1
fWD.wxXCkey=1
_(c6C,xUD)
}
f5C.wxXCkey=1
c6C.wxXCkey=1
}
var o4C=_v()
_(o2C,o4C)
if(_oz(z,33,e,s,gg)){o4C.wxVkey=1
}
x3C.wxXCkey=1
o4C.wxXCkey=1
_(r,o2C)
return r
}
e_[x[6]]={f:m6,j:[],i:[],ti:[],ic:[]}
d_[x[7]]={}
var m7=function(e,s,r,gg){
var z=gz$gwx_8()
return r
}
e_[x[7]]={f:m7,j:[],i:[],ti:[],ic:[]}
d_[x[8]]={}
var m8=function(e,s,r,gg){
var z=gz$gwx_9()
return r
}
e_[x[8]]={f:m8,j:[],i:[],ti:[],ic:[]}
d_[x[9]]={}
var m9=function(e,s,r,gg){
var z=gz$gwx_10()
var c1D=_v()
_(r,c1D)
if(_oz(z,0,e,s,gg)){c1D.wxVkey=1
}
c1D.wxXCkey=1
return r
}
e_[x[9]]={f:m9,j:[],i:[],ti:[],ic:[]}
d_[x[10]]={}
var m10=function(e,s,r,gg){
var z=gz$gwx_11()
return r
}
e_[x[10]]={f:m10,j:[],i:[],ti:[],ic:[]}
d_[x[11]]={}
var m11=function(e,s,r,gg){
var z=gz$gwx_12()
var a4D=_n('view')
_rz(z,a4D,'class',0,e,s,gg)
var t5D=_v()
_(a4D,t5D)
if(_oz(z,1,e,s,gg)){t5D.wxVkey=1
var fAE=_v()
_(t5D,fAE)
if(_oz(z,2,e,s,gg)){fAE.wxVkey=1
}
fAE.wxXCkey=1
}
var e6D=_v()
_(a4D,e6D)
if(_oz(z,3,e,s,gg)){e6D.wxVkey=1
var cBE=_v()
_(e6D,cBE)
if(_oz(z,4,e,s,gg)){cBE.wxVkey=1
}
cBE.wxXCkey=1
}
var b7D=_v()
_(a4D,b7D)
if(_oz(z,5,e,s,gg)){b7D.wxVkey=1
}
var hCE=_mz(z,'hero-ranking',['bind:profileupdate',6,'bind:retry',1,'currentUserProfile',2,'examId',3,'limit',4,'list',5,'loadError',6,'loading',7,'theme',8],[],e,s,gg)
_(a4D,hCE)
var o8D=_v()
_(a4D,o8D)
if(_oz(z,15,e,s,gg)){o8D.wxVkey=1
}
var x9D=_v()
_(a4D,x9D)
if(_oz(z,16,e,s,gg)){x9D.wxVkey=1
}
var oDE=_v()
_(a4D,oDE)
var cEE=function(lGE,oFE,aHE,gg){
var eJE=_v()
_(aHE,eJE)
if(_oz(z,19,lGE,oFE,gg)){eJE.wxVkey=1
}
eJE.wxXCkey=1
return aHE
}
oDE.wxXCkey=2
_2z(z,17,cEE,e,s,gg,oDE,'item','index','name')
var o0D=_v()
_(a4D,o0D)
if(_oz(z,20,e,s,gg)){o0D.wxVkey=1
}
t5D.wxXCkey=1
e6D.wxXCkey=1
b7D.wxXCkey=1
o8D.wxXCkey=1
x9D.wxXCkey=1
o0D.wxXCkey=1
_(r,a4D)
return r
}
e_[x[11]]={f:m11,j:[],i:[],ti:[],ic:[]}
d_[x[12]]={}
var m12=function(e,s,r,gg){
var z=gz$gwx_13()
var oLE=_n('view')
_rz(z,oLE,'class',0,e,s,gg)
var xME=_v()
_(oLE,xME)
if(_oz(z,1,e,s,gg)){xME.wxVkey=1
}
var oNE=_v()
_(oLE,oNE)
if(_oz(z,2,e,s,gg)){oNE.wxVkey=1
var cPE=_v()
_(oNE,cPE)
var hQE=function(cSE,oRE,oTE,gg){
var aVE=_mz(z,'view',['bindtap',5,'class',1,'data-index',2],[],cSE,oRE,gg)
var tWE=_v()
_(aVE,tWE)
if(_oz(z,8,cSE,oRE,gg)){tWE.wxVkey=1
}
tWE.wxXCkey=1
_(oTE,aVE)
return oTE
}
cPE.wxXCkey=2
_2z(z,3,hQE,e,s,gg,cPE,'item','index','_id')
}
var fOE=_v()
_(oLE,fOE)
if(_oz(z,9,e,s,gg)){fOE.wxVkey=1
}
var eXE=_mz(z,'hero-ranking',['bind:profileupdate',10,'bind:retry',1,'currentUserProfile',2,'examId',3,'list',4,'loadError',5,'loading',6,'showProfileHint',7,'theme',8,'title',9],[],e,s,gg)
_(oLE,eXE)
xME.wxXCkey=1
oNE.wxXCkey=1
fOE.wxXCkey=1
_(r,oLE)
return r
}
e_[x[12]]={f:m12,j:[],i:[],ti:[],ic:[]}
d_[x[13]]={}
var m13=function(e,s,r,gg){
var z=gz$gwx_14()
var oZE=_n('view')
_rz(z,oZE,'class',0,e,s,gg)
var x1E=_v()
_(oZE,x1E)
if(_oz(z,1,e,s,gg)){x1E.wxVkey=1
}
var o2E=_v()
_(oZE,o2E)
if(_oz(z,2,e,s,gg)){o2E.wxVkey=1
}
var f3E=_v()
_(oZE,f3E)
if(_oz(z,3,e,s,gg)){f3E.wxVkey=1
}
x1E.wxXCkey=1
o2E.wxXCkey=1
f3E.wxXCkey=1
_(r,oZE)
return r
}
e_[x[13]]={f:m13,j:[],i:[],ti:[],ic:[]}
d_[x[14]]={}
var m14=function(e,s,r,gg){
var z=gz$gwx_15()
var h5E=_v()
_(r,h5E)
if(_oz(z,0,e,s,gg)){h5E.wxVkey=1
}
h5E.wxXCkey=1
return r
}
e_[x[14]]={f:m14,j:[],i:[],ti:[],ic:[]}
d_[x[15]]={}
var m15=function(e,s,r,gg){
var z=gz$gwx_16()
var c7E=_n('view')
_rz(z,c7E,'class',0,e,s,gg)
var o8E=_v()
_(c7E,o8E)
if(_oz(z,1,e,s,gg)){o8E.wxVkey=1
}
var l9E=_v()
_(c7E,l9E)
if(_oz(z,2,e,s,gg)){l9E.wxVkey=1
}
var a0E=_v()
_(c7E,a0E)
if(_oz(z,3,e,s,gg)){a0E.wxVkey=1
}
var tAF=_v()
_(c7E,tAF)
if(_oz(z,4,e,s,gg)){tAF.wxVkey=1
}
o8E.wxXCkey=1
l9E.wxXCkey=1
a0E.wxXCkey=1
tAF.wxXCkey=1
_(r,c7E)
return r
}
e_[x[15]]={f:m15,j:[],i:[],ti:[],ic:[]}
d_[x[16]]={}
var m16=function(e,s,r,gg){
var z=gz$gwx_17()
var bCF=_mz(z,'view',['catchtap',0,'class',1],[],e,s,gg)
var oDF=_v()
_(bCF,oDF)
if(_oz(z,2,e,s,gg)){oDF.wxVkey=1
}
var xEF=_n('view')
_rz(z,xEF,'class',3,e,s,gg)
var oFF=_v()
_(xEF,oFF)
if(_oz(z,4,e,s,gg)){oFF.wxVkey=1
}
var fGF=_v()
_(xEF,fGF)
if(_oz(z,5,e,s,gg)){fGF.wxVkey=1
}
var cHF=_v()
_(xEF,cHF)
if(_oz(z,6,e,s,gg)){cHF.wxVkey=1
}
oFF.wxXCkey=1
fGF.wxXCkey=1
cHF.wxXCkey=1
_(bCF,xEF)
oDF.wxXCkey=1
_(r,bCF)
return r
}
e_[x[16]]={f:m16,j:[],i:[],ti:[],ic:[]}
d_[x[17]]={}
var m17=function(e,s,r,gg){
var z=gz$gwx_18()
var oJF=_n('view')
_rz(z,oJF,'class',0,e,s,gg)
var cKF=_v()
_(oJF,cKF)
if(_oz(z,1,e,s,gg)){cKF.wxVkey=1
}
var oLF=_v()
_(oJF,oLF)
if(_oz(z,2,e,s,gg)){oLF.wxVkey=1
}
var lMF=_v()
_(oJF,lMF)
if(_oz(z,3,e,s,gg)){lMF.wxVkey=1
}
cKF.wxXCkey=1
oLF.wxXCkey=1
lMF.wxXCkey=1
_(r,oJF)
return r
}
e_[x[17]]={f:m17,j:[],i:[],ti:[],ic:[]}
if(path&&e_[path]){
return function(env,dd,global){$gwxc=0;var root={"tag":"wx-page"};root.children=[]
var main=e_[path].f
if (typeof global==="undefined")global={};global.f=$gdc(f_[path],"",1);
try{
main(env,{},root,global);
_tsd(root)
}catch(err){
console.log(err)
}
return root;
}
}
}
	__wxAppCode__['components/hero-ranking/hero-ranking.json'] = {"component":true,"usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['components/hero-ranking/hero-ranking.wxml'] = [$gwx, './components/hero-ranking/hero-ranking.wxml'];else __wxAppCode__['components/hero-ranking/hero-ranking.wxml'] = $gwx( './components/hero-ranking/hero-ranking.wxml' );
		__wxAppCode__['pages/admin/report-list/report-list.json'] = {"navigationBarTitleText":"错误反馈列表","enablePullDownRefresh":true,"usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/admin/report-list/report-list.wxml'] = [$gwx, './pages/admin/report-list/report-list.wxml'];else __wxAppCode__['pages/admin/report-list/report-list.wxml'] = $gwx( './pages/admin/report-list/report-list.wxml' );
		__wxAppCode__['pages/exam/exam.json'] = {"usingComponents":{},"navigationBarTitleText":"正在答题","enablePullDownRefresh":true,"backgroundTextStyle":"dark"};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/exam/exam.wxml'] = [$gwx, './pages/exam/exam.wxml'];else __wxAppCode__['pages/exam/exam.wxml'] = $gwx( './pages/exam/exam.wxml' );
		__wxAppCode__['pages/fb-tool/fb-tool.json'] = {"usingComponents":{},"navigationBarTitleText":"FB排版工具获取"};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/fb-tool/fb-tool.wxml'] = [$gwx, './pages/fb-tool/fb-tool.wxml'];else __wxAppCode__['pages/fb-tool/fb-tool.wxml'] = $gwx( './pages/fb-tool/fb-tool.wxml' );
		__wxAppCode__['pages/idiom-reader/idiom-reader.json'] = {"usingComponents":{},"navigationBarTitleText":"阅读正文"};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/idiom-reader/idiom-reader.wxml'] = [$gwx, './pages/idiom-reader/idiom-reader.wxml'];else __wxAppCode__['pages/idiom-reader/idiom-reader.wxml'] = $gwx( './pages/idiom-reader/idiom-reader.wxml' );
		__wxAppCode__['pages/idiom/idiom.json'] = {"usingComponents":{},"navigationBarTitleText":"官媒搜索"};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/idiom/idiom.wxml'] = [$gwx, './pages/idiom/idiom.wxml'];else __wxAppCode__['pages/idiom/idiom.wxml'] = $gwx( './pages/idiom/idiom.wxml' );
		__wxAppCode__['pages/index/index.json'] = {"usingComponents":{},"enablePullDownRefresh":true};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/index/index.wxml'] = [$gwx, './pages/index/index.wxml'];else __wxAppCode__['pages/index/index.wxml'] = $gwx( './pages/index/index.wxml' );
		__wxAppCode__['pages/letter/letter.json'] = {"usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/letter/letter.wxml'] = [$gwx, './pages/letter/letter.wxml'];else __wxAppCode__['pages/letter/letter.wxml'] = $gwx( './pages/letter/letter.wxml' );
		__wxAppCode__['pages/math-tools/menu/menu.json'] = {"navigationBarTitleText":"数学计算","usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/math-tools/menu/menu.wxml'] = [$gwx, './pages/math-tools/menu/menu.wxml'];else __wxAppCode__['pages/math-tools/menu/menu.wxml'] = $gwx( './pages/math-tools/menu/menu.wxml' );
		__wxAppCode__['pages/math-tools/percentage/percentage.json'] = {"navigationBarTitleText":"百化分训练","navigationBarBackgroundColor":"#ffffff","navigationBarTextStyle":"black","disableScroll":true,"usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/math-tools/percentage/percentage.wxml'] = [$gwx, './pages/math-tools/percentage/percentage.wxml'];else __wxAppCode__['pages/math-tools/percentage/percentage.wxml'] = $gwx( './pages/math-tools/percentage/percentage.wxml' );
		__wxAppCode__['pages/percentage-result/percentage-result.json'] = {"navigationBarTitleText":"练习结果","navigationBarBackgroundColor":"#ffffff","navigationBarTextStyle":"black","usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/percentage-result/percentage-result.wxml'] = [$gwx, './pages/percentage-result/percentage-result.wxml'];else __wxAppCode__['pages/percentage-result/percentage-result.wxml'] = $gwx( './pages/percentage-result/percentage-result.wxml' );
		__wxAppCode__['pages/result/result.json'] = {"usingComponents":{"hero-ranking":"../../components/hero-ranking/hero-ranking"}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/result/result.wxml'] = [$gwx, './pages/result/result.wxml'];else __wxAppCode__['pages/result/result.wxml'] = $gwx( './pages/result/result.wxml' );
		__wxAppCode__['pages/set-history/set-history.json'] = {"usingComponents":{"hero-ranking":"../../components/hero-ranking/hero-ranking"}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/set-history/set-history.wxml'] = [$gwx, './pages/set-history/set-history.wxml'];else __wxAppCode__['pages/set-history/set-history.wxml'] = $gwx( './pages/set-history/set-history.wxml' );
		__wxAppCode__['pages/timer-records/timer-records.json'] = {"navigationBarTitleText":"本地计时记录","navigationBarBackgroundColor":"#2C3E50","navigationBarTextStyle":"white","backgroundColor":"#F5F7FA","usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/timer-records/timer-records.wxml'] = [$gwx, './pages/timer-records/timer-records.wxml'];else __wxAppCode__['pages/timer-records/timer-records.wxml'] = $gwx( './pages/timer-records/timer-records.wxml' );
		__wxAppCode__['pages/timer-report/timer-report.json'] = {"navigationBarTitleText":"训练分析报告","navigationBarBackgroundColor":"#2C3E50","navigationBarTextStyle":"white","backgroundColor":"#F5F7FA","usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/timer-report/timer-report.wxml'] = [$gwx, './pages/timer-report/timer-report.wxml'];else __wxAppCode__['pages/timer-report/timer-report.wxml'] = $gwx( './pages/timer-report/timer-report.wxml' );
		__wxAppCode__['pages/timer-setup/timer-setup.json'] = {"navigationBarTitleText":"备考计时器","navigationBarBackgroundColor":"#2C3E50","navigationBarTextStyle":"white","backgroundColor":"#F5F7FA","usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/timer-setup/timer-setup.wxml'] = [$gwx, './pages/timer-setup/timer-setup.wxml'];else __wxAppCode__['pages/timer-setup/timer-setup.wxml'] = $gwx( './pages/timer-setup/timer-setup.wxml' );
		__wxAppCode__['pages/timer/timer.json'] = {"navigationBarTitleText":"备考计时器","pageOrientation":"landscape","navigationStyle":"custom","backgroundColor":"#000000","usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/timer/timer.wxml'] = [$gwx, './pages/timer/timer.wxml'];else __wxAppCode__['pages/timer/timer.wxml'] = $gwx( './pages/timer/timer.wxml' );
		__wxAppCode__['pages/user-list/user-list.json'] = {"navigationBarTitleText":"所有用户","enablePullDownRefresh":true,"backgroundColor":"#F9F9F9","usingComponents":{}};
		if (__vd_version_info__.delayedGwx) __wxAppCode__['pages/user-list/user-list.wxml'] = [$gwx, './pages/user-list/user-list.wxml'];else __wxAppCode__['pages/user-list/user-list.wxml'] = $gwx( './pages/user-list/user-list.wxml' );
	
	define("@swc/runtime/_array_like_to_array.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _array_like_to_array(r,a){(null==a||a>r.length)&&(a=r.length);for(var t=0,_=Array(a);t<a;t++)_[t]=r[t];return _}exports._=_array_like_to_array; 
 			}); 
		define("@swc/runtime/_array_with_holes.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _array_with_holes(r){if(Array.isArray(r))return r}exports._=_array_with_holes; 
 			}); 
		define("@swc/runtime/_array_without_holes.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var _array_like_to_array=require("./_array_like_to_array.js");function _array_without_holes(r){if(Array.isArray(r))return _array_like_to_array._(r)}exports._=_array_without_holes; 
 			}); 
		define("@swc/runtime/_async_to_generator.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function asyncGeneratorStep(n,r,e,t,o,a,c){try{var s=n[a](c),i=s.value}catch(n){e(n);return}s.done?r(i):Promise.resolve(i).then(t,o)}function _async_to_generator(n){return function(){var r=this,e=arguments;return new Promise(function(t,o){var a=n.apply(r,e);function c(n){asyncGeneratorStep(a,t,o,c,s,"next",n)}function s(n){asyncGeneratorStep(a,t,o,c,s,"throw",n)}c(void 0)})}}exports._=_async_to_generator; 
 			}); 
		define("@swc/runtime/_class_call_check.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _class_call_check(c,a){if(!(c instanceof a))throw TypeError("Cannot call a class as a function")}exports._=_class_call_check; 
 			}); 
		define("@swc/runtime/_create_class.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _defineProperties(e,r){for(var t=0;t<r.length;t++){var n=r[t];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function _create_class(e,r,t){return r&&_defineProperties(e.prototype,r),t&&_defineProperties(e,t),e}exports._=_create_class; 
 			}); 
		define("@swc/runtime/_define_property.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _define_property(e,r,t){return r in e?Object.defineProperty(e,r,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[r]=t,e}exports._=_define_property; 
 			}); 
		define("@swc/runtime/_iterable_to_array.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _iterable_to_array(r){if("u">typeof Symbol&&null!=r[Symbol.iterator]||null!=r["@@iterator"])return Array.from(r)}exports._=_iterable_to_array; 
 			}); 
		define("@swc/runtime/_iterable_to_array_limit.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _iterable_to_array_limit(r,t){var l,e,a=null==r?null:"u">typeof Symbol&&r[Symbol.iterator]||r["@@iterator"];if(null!=a){var i=[],n=!0,o=!1;try{for(a=a.call(r);!(n=(l=a.next()).done)&&(i.push(l.value),!t||i.length!==t);n=!0);}catch(r){o=!0,e=r}finally{try{n||null==a.return||a.return()}finally{if(o)throw e}}return i}}exports._=_iterable_to_array_limit; 
 			}); 
		define("@swc/runtime/_non_iterable_rest.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _non_iterable_rest(){throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}exports._=_non_iterable_rest; 
 			}); 
		define("@swc/runtime/_non_iterable_spread.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _non_iterable_spread(){throw TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}exports._=_non_iterable_spread; 
 			}); 
		define("@swc/runtime/_object_spread.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var _define_property=require("./_define_property.js");function _object_spread(e){for(var r=1;r<arguments.length;r++){var t=null!=arguments[r]?arguments[r]:{},n=Object.keys(t);"function"==typeof Object.getOwnPropertySymbols&&(n=n.concat(Object.getOwnPropertySymbols(t).filter(function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.forEach(function(r){_define_property._(e,r,t[r])})}return e}exports._=_object_spread; 
 			}); 
		define("@swc/runtime/_object_spread_props.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function ownKeys(e,r){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);r&&(o=o.filter(function(r){return Object.getOwnPropertyDescriptor(e,r).enumerable})),t.push.apply(t,o)}return t}function _object_spread_props(e,r){return r=null!=r?r:{},Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}),e}exports._=_object_spread_props; 
 			}); 
		define("@swc/runtime/_sliced_to_array.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var _array_with_holes=require("./_array_with_holes.js"),_iterable_to_array_limit=require("./_iterable_to_array_limit.js"),_non_iterable_rest=require("./_non_iterable_rest.js"),_unsupported_iterable_to_array=require("./_unsupported_iterable_to_array.js");function _sliced_to_array(_,r){return _array_with_holes._(_)||_iterable_to_array_limit._(_,r)||_unsupported_iterable_to_array._(_,r)||_non_iterable_rest._()}exports._=_sliced_to_array; 
 			}); 
		define("@swc/runtime/_to_consumable_array.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var _array_without_holes=require("./_array_without_holes.js"),_iterable_to_array=require("./_iterable_to_array.js"),_non_iterable_spread=require("./_non_iterable_spread.js"),_unsupported_iterable_to_array=require("./_unsupported_iterable_to_array.js");function _to_consumable_array(r){return _array_without_holes._(r)||_iterable_to_array._(r)||_unsupported_iterable_to_array._(r)||_non_iterable_spread._()}exports._=_to_consumable_array; 
 			}); 
		define("@swc/runtime/_ts_generator.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
(()=>{"use strict";var e={d:(t,r)=>{for(var o in r)e.o(r,o)&&!e.o(t,o)&&Object.defineProperty(t,o,{enumerable:!0,get:r[o]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})}},t={};function r(e,t){var r,o,n,a={label:0,sent:function(){if(1&n[0])throw n[1];return n[1]},trys:[],ops:[]},l=Object.create(("function"==typeof Iterator?Iterator:Object).prototype);return l.next=u(0),l.throw=u(1),l.return=u(2),"function"==typeof Symbol&&(l[Symbol.iterator]=function(){return this}),l;function u(u){return function(c){return function(u){if(r)throw new TypeError("Generator is already executing.");for(;l&&(l=0,u[0]&&(a=0)),a;)try{if(r=1,o&&(n=2&u[0]?o.return:u[0]?o.throw||((n=o.return)&&n.call(o),0):o.next)&&!(n=n.call(o,u[1])).done)return n;switch(o=0,n&&(u=[2&u[0],n.value]),u[0]){case 0:case 1:n=u;break;case 4:return a.label++,{value:u[1],done:!1};case 5:a.label++,o=u[1],u=[0];continue;case 7:u=a.ops.pop(),a.trys.pop();continue;default:if(!((n=(n=a.trys).length>0&&n[n.length-1])||6!==u[0]&&2!==u[0])){a=0;continue}if(3===u[0]&&(!n||u[1]>n[0]&&u[1]<n[3])){a.label=u[1];break}if(6===u[0]&&a.label<n[1]){a.label=n[1],n=u;break}if(n&&a.label<n[2]){a.label=n[2],a.ops.push(u);break}n[2]&&a.ops.pop(),a.trys.pop();continue}u=t.call(e,a)}catch(e){u=[6,e],o=0}finally{r=n=0}if(5&u[0])throw u[1];return{value:u[0]?u[1]:void 0,done:!0}}([u,c])}}}e.r(t),e.d(t,{_:()=>r}),Object.create,Object.create,"function"==typeof SuppressedError&&SuppressedError,module.exports=t})(); 
 			}); 
		define("@swc/runtime/_type_of.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";function _type_of(o){return o&&"u">typeof Symbol&&o.constructor===Symbol?"symbol":typeof o}exports._=_type_of; 
 			}); 
		define("@swc/runtime/_unsupported_iterable_to_array.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var _array_like_to_array=require("./_array_like_to_array.js");function _unsupported_iterable_to_array(r,t){if(r){if("string"==typeof r)return _array_like_to_array._(r,t);var a=Object.prototype.toString.call(r).slice(8,-1);if("Object"===a&&r.constructor&&(a=r.constructor.name),"Map"===a||"Set"===a)return Array.from(a);if("Arguments"===a||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(a))return _array_like_to_array._(r,t)}}exports._=_unsupported_iterable_to_array; 
 			}); 
		define("cloudfunctions/autoExportStatic/answer-compat.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var r=require("../../@swc/runtime/_sliced_to_array"),e=require("../../@swc/runtime/_type_of"),n=["A","B","C","D"],s=function(r,e){return Object.prototype.hasOwnProperty.call(r||{},e)},t=function(r){return r&&(void 0===r?"undefined":e._(r))==="object"&&!Array.isArray(r)};function u(r){return!!r&&(!!(s(r,"userAnswers")&&(t(r.userAnswers)||Array.isArray(r.userAnswers)||"string"==typeof r.userAnswers))||!!(t(r.userWrongAnswers)&&Array.isArray(r.unansweredQuestions)))}function a(e,s){var t={},u="string"==typeof e||Array.isArray(e)?Array.from(e,function(r,e){return[e+1,r]}):Object.entries(e||{}),a=!0,o=!1,i=void 0;try{for(var l,c=u[Symbol.iterator]();!(a=(l=c.next()).done);a=!0){var y=r._(l.value,2),f=y[0],A=y[1],w=Number(String(f).replace(/^q_/,"")),d=String(A||"").trim().toUpperCase();Number.isInteger(w)&&w>=1&&w<=s&&n.includes(d)&&(t["q_".concat(w)]=d)}}catch(r){o=!0,i=r}finally{try{a||null==c.return||c.return()}finally{if(o)throw i}}return t}module.exports={hasAnswerPayload:u,restoreUserAnswers:function(r,e,n){if(!u(r))return null;if(s(r,"userAnswers")&&null!=r.userAnswers)return a(r.userAnswers,n);var t=a(r.correctAnswers,n),o=Object.keys(t).length?t:a(e,n),i=a(r.userWrongAnswers,n),l=new Set(r.unansweredQuestions.map(function(r){return Number(String(r).replace(/^q_/,""))})),c=!0,y=!1,f=void 0;try{for(var A,w=Object.keys(r.userWrongAnswers)[Symbol.iterator]();!(c=(A=w.next()).done);c=!0){var d=A.value;l.add(Number(String(d).replace(/^q_/,"")))}}catch(r){y=!0,f=r}finally{try{c||null==w.return||w.return()}finally{if(y)throw f}}for(var p={},_=1;_<=n;_++){var v="q_".concat(_);if(i[v])p[v]=i[v];else if(!l.has(_)&&o[v])p[v]=o[v];else if(!l.has(_))return null}return p}}; 
 			}); 
		define("cloudfunctions/autoExportStatic/exam-catalog.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_object_spread"),t=require("../../@swc/runtime/_object_spread_props"),r=require("../../@swc/runtime/_to_consumable_array"),i=function(e){return"string"==typeof e&&/^[A-Za-z0-9_-]{1,128}$/.test(e)},n=function(e,t){return"string"==typeof e&&e.trim()&&e.length<=t};function a(e){if(!Array.isArray(e)||e.length>2e3)return!1;var t=new Set;return e.every(function(e){return!(!e||!i(e.setKey)||t.has(e.setKey))&&!!Number.isInteger(e.count)&&!(e.count<1)&&!(e.count>1e3)&&(t.add(e.setKey),!0)})}function o(e){return e&&i(e.id)&&i(e.prefix)&&n(e.title,60)&&["peanut","chaoge","fenbi"].includes(e.library)?{id:e.id,library:e.library,title:e.title.trim(),prefix:e.prefix,color:/^#[0-9a-fA-F]{6}$/.test(e.color)?e.color:"#A2D2FF",icon:n(e.icon,8)?e.icon:"peanut"===e.library?"\uD83E\uDD5C":"\uD83D\uDCD8",sort:Number.isFinite(e.sort)?e.sort:999,isNew:!0===e.isNew}:null}module.exports={validRows:a,normalizeCategory:o,buildAvailableRows:function(e){var t=new Map,r=e.map(function(e){var r={_id:e._id,setKey:e.setKey,count:Number(e.count)},i=e.catalog||{},a=o(i.category);if(a){if(!e.setKey.startsWith(a.prefix+"-"))throw Error("试卷编号与分类前缀不匹配："+e.setKey);var u=t.get(a.id);if(u&&JSON.stringify(u)!==JSON.stringify(a))throw Error("同一分类配置不一致："+a.id);t.set(a.id,a),r._categoryId=a.id}return!1===i.hasPdf&&(r.hasPdf=!1),Number.isInteger(i.extraCount)&&i.extraCount>0&&i.extraCount<r.count&&(r.extraCount=i.extraCount),n(i.displayTitle,40)&&(r.title=i.displayTitle),r});if(!a(r))throw Error("目录编号、题数或重复条目无效");var i=new Set;return r.map(function(e){var r=e._categoryId;return delete e._categoryId,r&&!i.has(r)&&(e.category=t.get(r),i.add(r)),e})},mergeCategories:function(i,n,a){var u=new Map(i.map(function(r,i){return[r.id,t._(e._({},r),{prefix:a(r.id),sort:i})]})),s=!0,l=!1,f=void 0;try{for(var c,d=n[Symbol.iterator]();!(s=(c=d.next()).done);s=!0)!function(){var t=c.value,i=o(t.category);!i||!t.setKey.startsWith(i.prefix+"-")||u.has(i.id)&&u.get(i.id).prefix!==i.prefix||r._(u.values()).some(function(e){return e.id!==i.id&&e.prefix===i.prefix})||u.set(i.id,e._({},u.get(i.id),i))}()}catch(e){l=!0,f=e}finally{try{s||null==d.return||d.return()}finally{if(l)throw f}}return r._(u.values()).map(function(r){var i=new Set(n.filter(function(e){return e.setKey.startsWith(r.prefix+"-")}).map(function(e){return e.setKey}));return t._(e._({},r),{count:Math.max(Number(r.count)||0,i.size)})}).sort(function(e,t){return e.sort-t.sort})},mergePeriods:function(t,i,a){var o=new Map(i.map(function(t){return[t.examId,e._({},t)]}));if(!t||!t.prefix)return r._(o.values());var u=!0,s=!1,l=void 0;try{for(var f,c=a[Symbol.iterator]();!(u=(f=c.next()).done);u=!0){var d=f.value;if(d.setKey.startsWith(t.prefix+"-")){var y=d.setKey.slice(t.prefix.length+1);if(/^[1-9]\d*$/.test(y)){var p=o.get(d.setKey),m=Number(d.extraCount)||0,x=p||{id:t.id+"_"+y,examId:d.setKey,title:"第"+y+"套",subTitle:m?d.count-m+"题＋附加"+m+"题":"共"+d.count+"题"};n(d.title,40)&&(x.title=d.title),!1!==d.hasPdf&&p||(x.hasPdf=!1!==d.hasPdf),x.hasOnlineExam=!0,o.set(d.setKey,x)}}}}catch(e){s=!0,l=e}finally{try{u||null==c.return||c.return()}finally{if(s)throw l}}return r._(o.values()).sort(function(e,t){return Number(e.examId.split("-").pop())-Number(t.examId.split("-").pop())})}}; 
 			}); 
		define("cloudfunctions/autoExportStatic/exam-model.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var r=["A","B","C","D"];function e(r){if(!Array.isArray(r)||!r.length)throw Error("试卷章节为空");var e=0,t=r.map(function(r,t){if(!r||!Number.isInteger(Number(r.count))||0>Number(r.count))throw Error("试卷题数无效");var n=Number(r.count);if((e+=n)>1e3)throw Error("试卷题数无效");var i=String(r.name||r.title||"第".concat(t+1,"章"));return{id:r.id||"sec".concat(t+1),name:i,count:n,scored:!1!==r.scored&&"sec_extra"!==r.id&&!/附加|不计分/.test(i)}}).filter(function(r){return r.count>0});if(!e)throw Error("试卷没有题目");return t}module.exports={OPTIONS:r,CARD_COUNT:140,normalizeSections:e,correctFromSections:function(e){var t={},n=0,i=!0,o=!1,a=void 0;try{for(var s,u=(e||[])[Symbol.iterator]();!(i=(s=u.next()).done);i=!0){var c=s.value,l=Number(c.count);if(!Number.isInteger(l)||l<0||n+l>1e3)throw Error("试卷题数无效");for(var f="string"==typeof c.answers?c.answers.split(""):Array.isArray(c.answers)?c.answers:[],d=0;d<l;d++)r.includes(f[d])&&(t["q_".concat(n+d+1)]=f[d]);n+=l}}catch(r){o=!0,a=r}finally{try{i||null==u.return||u.return()}finally{if(o)throw a}}return t},sanitizeAnswers:function(e,t){for(var n={},i=1;i<=t;i++){var o=e&&e["q_".concat(i)];r.includes(o)&&(n["q_".concat(i)]=o)}return n},structureKey:function(r){return JSON.stringify(e(r))},importScan:function(e,t,n){if(!Number.isInteger(n)||n<1||n>140)throw Error("此答题卡最多支持140题");if(!e||e.examId!==t||!e.meta||"OMR-140-v2"!==e.meta.templateId||!Array.isArray(e.items)||140!==e.items.length)throw Error("扫描结果与所选试卷不一致");var i={},o={},a=[],s=0,u=0;return e.items.forEach(function(e,t){if(!e||e.number!==t+1||!["filled","blank","review"].includes(e.status)||("filled"===e.status?!r.includes(e.answer):null!=e.answer))throw Error("扫描结果格式不完整，请重新扫描");if(e.number>n){"filled"===e.status&&s++,"review"===e.status&&u++;return}var c="q_".concat(e.number);"filled"===e.status&&(i[c]=e.answer),"review"===e.status&&(o[c]=!0,a.push({id:c,number:e.number,reason:e.reason||"填涂未读清，请核对纸卡",candidate:r.includes(e.candidate)?e.candidate:""}))}),{answers:i,reviewMap:o,reviewQuestions:a,ignoredFilled:s,ignoredReview:u}},grade:function(t,n,i,o){var a=0,s=0,u=0,c=!0,l=!1,f=void 0;try{for(var d,m=e(i)[Symbol.iterator]();!(c=(d=m.next()).done);c=!0){for(var v=d.value,w=1;w<=v.count;w++)v.scored&&(u++,r.includes(t["q_".concat(a+w)])&&t["q_".concat(a+w)]===n["q_".concat(a+w)]&&s++);a+=v.count}}catch(r){l=!0,f=r}finally{try{c||null==m.return||m.return()}finally{if(l)throw f}}var h=String(o||"").startsWith("26-huasheng-shiye-A")?(1.5*s).toFixed(1):(u?100*s/u:0).toFixed(1);return{correctCount:s,totalQuestions:u,score:h}}}; 
 			}); 
		define("cloudfunctions/autoExportStatic/hero-detail.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var r=require("../../@swc/runtime/_sliced_to_array"),e=require("../../@swc/runtime/_type_of"),n=require("./answer-compat.js"),t=n.hasAnswerPayload,s=n.restoreUserAnswers,u=require("./exam-model.js"),o=u.normalizeSections,c=u.correctFromSections,a=["A","B","C","D"];function i(e,n){var t={},s="string"==typeof e||Array.isArray(e)?Array.from(e,function(r,e){return[e+1,r]}):Object.entries(e||{}),u=!0,o=!1,c=void 0;try{for(var i,l=s[Symbol.iterator]();!(u=(i=l.next()).done);u=!0){var w=r._(i.value,2),m=w[0],f=w[1],A=Number(String(m).replace(/^q_/,"")),v=String(f||"").trim().toUpperCase();Number.isInteger(A)&&A>=1&&A<=n&&a.includes(v)&&(t["q_"+A]=v)}}catch(r){o=!0,c=r}finally{try{u||null==l.return||l.return()}finally{if(o)throw c}}return t}function l(r){var n,u=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(!r||!1===r.answerDetailsAvailable||!t(r))return null;try{n=o(r.examStructure||u.sections||u.examStructure)}catch(r){return null}var a=n.reduce(function(r,e){return r+e.count},0),l=i(r.correctAnswers,a);if(!Object.keys(l).length){var w=!0;if(r.examStructure&&u.sections)try{var m=o(u.sections);w=JSON.stringify(n.map(function(r){return r.count}))===JSON.stringify(m.map(function(r){return r.count}))}catch(r){w=!1}w&&(l=u.sections?c(u.sections):i(u.answers,a))}if(r.userAnswers&&"object"===e._(r.userAnswers)&&!Object.keys(r.userAnswers).length&&(Number(r.correctCount)>0||Number(r.score)>0))return null;var f=s(r,l,a);if(null===f)return null;var A=0,v=0,y=0,d=0,p=0,_=0,b=n.map(function(r){for(var e=0,n=0,t=[],s=0;s<r.count;s++){var u=++A,o="q_"+u,c=f[o],a=l[o],i=c?a?c===a?"correct":"wrong":"unknown":"unanswered";"correct"===i&&e++,"wrong"===i&&n++,r.scored&&(_++,"correct"===i&&v++,"wrong"===i&&y++,"unanswered"===i&&d++,"unknown"===i&&p++),t.push({num:u,status:i,uAns:c||"-",cAns:a||"?"})}return{name:r.name,correct:e,wrong:n,total:r.count,isScoring:r.scored,accuracy:(e/r.count*100).toFixed(0)+"%",questions:t}});return{userAnswers:f,correctAnswers:l,examStructure:n,sectionStats:b,totalQuestions:_,correctCount:v,wrongCount:y,unansweredCount:d,unknownCount:p}}module.exports={buildHeroDetail:l,publicAnswerFields:function(r,e){var n=l(r,e);return n?{userAnswers:n.userAnswers,correctAnswers:n.correctAnswers,examStructure:n.examStructure,answerDetailsAvailable:!0}:{userAnswers:null,correctAnswers:null,answerDetailsAvailable:!1}}}; 
 			}); 
		define("cloudfunctions/autoExportStatic/index.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),t=require("../../@swc/runtime/_object_spread"),r=require("../../@swc/runtime/_sliced_to_array"),n=require("../../@swc/runtime/_to_consumable_array"),a=require("../../@swc/runtime/_ts_generator"),o=require("wx-server-sdk");o.init({env:o.DYNAMIC_CURRENT_ENV});var s=o.database(),c=s.command,i=require("./hero-detail.js").publicAnswerFields,l=require("./exam-catalog.js").buildAvailableRows,u=function(t,r){return e._(function(){var e,n,s,c;return a._(this,function(a){switch(a.label){case 0:return a.trys.push([0,2,,3]),e="exam_data/".concat(t),n=Buffer.from(JSON.stringify(r),"utf8"),[4,o.uploadFile({cloudPath:e,fileContent:n})];case 1:return s=a.sent(),console.log("[Upload Success] ".concat(t," -> ").concat(s.fileID)),[2,s.fileID];case 2:throw c=a.sent(),console.error("[Upload Error] ".concat(t),c),c;case 3:return[2]}})})()},d=function(t){return e._(function(){var e;return a._(this,function(r){switch(r.label){case 0:return r.trys.push([0,3,,4]),[4,s.collection("exam_data").doc(t).get()];case 1:return(e=r.sent()).data&&e.data.answers&&e.data.sections&&delete e.data.answers,[4,u("".concat(t,".json"),e.data)];case 2:return r.sent(),[2,e.data];case 3:return console.error("Export exam data failed",r.sent()),[3,4];case 4:return[2]}})})()},h=function(r){var o=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};return e._(function(){var e,l,d,h,f,g,p,m,x,_,b,w,y,S,v,E,k,I,N,q,T;return a._(this,function(a){switch(a.label){case 0:return a.trys.push([0,13,,14]),[4,s.collection("exam_history").where({examId:r,score:c.exists(!0)}).count()];case 1:return l=(e=a.sent())&&e.total||0,[4,s.collection("exam_history").aggregate().match({examId:r,score:c.exists(!0),_openid:c.exists(!0)}).group({_id:"$_openid"}).count("total").end()];case 2:return f=Math.min(2e3,Math.max(300,2*Math.ceil(.01*(h=(d=a.sent()).list&&d.list[0]&&d.list[0].total||0))+100)),[4,s.collection("exam_history").where({examId:r,score:c.exists(!0)}).orderBy("score","desc").limit(f).get()];case 3:if(g=a.sent().data||[],console.log("[Leaderboard] ".concat(r,": records=").concat(l,", users=").concat(h,", window=").concat(g.length," (windowSize=").concat(f,")")),p=[],g.forEach(function(e){!1!==o.fixStringScores&&"string"==typeof e.score&&p.push(s.collection("exam_history").doc(e._id).update({data:{score:Number(e.score)}}).catch(function(e){return console.error("Fix score failed",e)}))}),!(p.length>0))return[3,5];return console.log("Fixing ".concat(p.length," records...")),[4,Promise.allSettled(p)];case 4:a.sent(),a.label=5;case 5:if(m=g.slice().sort(function(e,t){return Number(t.score)-Number(e.score)}),x=new Map,m.forEach(function(e){var t=e._openid||e._id;x.has(t)||x.set(t,e)}),_=Array.from(x.values()),console.log("[Leaderboard] ".concat(r,": window unique users ").concat(_.length)),b=h<100?0:Math.floor(.01*h),w=_.slice(0,b),y=_.slice(b),S=w.length?Number(w[w.length-1].score):null,console.log("[Leaderboard] ".concat(r,": Excluded top 1% (").concat(b,"); eligible ").concat(y.length)),v=y.slice(0,100),E=[],v.forEach(function(e){e.nickName&&e.avatarUrl||E.push(e._openid)}),!(E.length>0)||!((k=n._(new Set(E))).length>0))return[3,7];return[4,s.collection("app_users").where({_openid:c.in(k)}).get()];case 6:I=a.sent(),N={},I.data.forEach(function(e){return N[e._openid]=e}),v.forEach(function(e){if(!e.nickName||!e.avatarUrl){var t=N[e._openid];t&&(e.nickName=e.nickName||t.nickName||t.nickname||"神秘考友",e.avatarUrl=e.avatarUrl||t.avatarUrl||t.avatar||"")}}),a.label=7;case 7:if(q={},!v.length)return[3,11];a.label=8;case 8:return a.trys.push([8,10,,11]),[4,s.collection("exam_data").doc(r).get()];case 9:return q=a.sent().data||{},[3,11];case 10:return a.sent(),console.warn("[Leaderboard] Exam detail key unavailable",r),[3,11];case 11:return(T=v.map(function(e,n){return t._({_id:e._id,_openid:e._openid,score:e.score,time:e.time||0,timestamp:e.timestamp,nickName:e.nickName||"神秘考友",avatarUrl:e.avatarUrl||"",rank:n+1,correctCount:e.correctCount||0,totalQuestions:e.totalQuestions||0,examId:r},n<20?i(e,q):{userAnswers:null,correctAnswers:null,answerDetailsAvailable:!1})})).length&&null!==S&&(T[0]._heroExcludedScoreThreshold=S),[4,u("leaderboard_".concat(r,".json"),T)];case 12:return a.sent(),[2,T];case 13:return console.error("Export leaderboard failed",a.sent()),[3,14];case 14:return[2]}})})()},f=function(t){return e._(function(){var e,r;return a._(this,function(n){switch(n.label){case 0:n.trys.push([0,6,,7]),n.label=1;case 1:return n.trys.push([1,3,,4]),[4,s.collection("exam_rank_stats").doc(t).get()];case 2:return e=n.sent(),[3,4];case 3:return n.sent(),console.warn("[Rank Stats] No stats found for ".concat(t,", skipping.")),[2,null];case 4:return r=e.data,[4,u("rank_stats_".concat(t,".json"),{totalCount:r.totalCount,scoreRankMap:r.scoreRankMap||{},questionStats:r.questionStats||{},filteredQuestionStats:r.filteredQuestionStats||{},updateTime:r.updateTime||new Date(r.updatedAt).getTime()})];case 5:return n.sent(),[2,e.data];case 6:return console.error("Export rank stats failed",n.sent()),[3,7];case 7:return[2]}})})()},g=function(){var t=!(arguments.length>0)||void 0===arguments[0]||arguments[0];return e._(function(){var e,r,o,c,i,d;return a._(this,function(a){switch(a.label){case 0:a.trys.push([0,7,,8]),e=100,r=[],o=0,a.label=1;case 1:if(!(o<2e3))return[3,4];return[4,s.collection("exam_data").field({setKey:!0,count:!0,catalog:!0}).orderBy("_id","asc").skip(o).limit(e).get()];case 2:if(i=a.sent().data||[],(c=r).push.apply(c,n._(i)),i.length<e)return[3,4];a.label=3;case 3:return o+=e,[3,1];case 4:if(2e3===r.length)throw Error("试卷目录达到导出上限，请扩展分页");if(!(d=l(r)).length)throw Error("不能发布空目录");if(!t)return[3,6];return[4,u("available_exams.json",d)];case 5:a.sent(),a.label=6;case 6:return[2,d];case 7:return console.error("Export available exams failed",a.sent()),[2,[]];case 8:return[2]}})})()};exports.main=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return arguments.length>1&&arguments[1],e._(function(){var c,i,p,m,x,_,b,w,y,S,v,E,k,I,N,q,T,C,j,A,M,P,R,D,U,F,K,O,L,z,B,G,Q,H,$,J,W,V,X,Y,Z,ee,et,er,en,ea,eo,es,ec,ei,el;return a._(this,function(eu){switch(eu.label){case 0:console.log("Auto Export Static JSON Triggered"),eu.label=1;case 1:if(eu.trys.push([1,50,,51]),c=o.getWXContext(),"policy"===t.operation)return[2,{success:!0,guokaoHours:24,otherHours:48,clientExports:!1}];if(c.OPENID)return[2,{success:!0,status:"scheduled_only"}];if("publishCatalog"!==t.operation)return[3,3];return[4,g(!0)];case 2:if(!(i=eu.sent()).length)throw Error("目录为空或校验失败，未完成发布");return[2,{success:!0,mode:"catalogOnly",count:i.length,categories:i.filter(function(e){return e.category}).length}];case 3:if("publishExams"!==t.operation)return[3,33];if(!Array.isArray(t.examIds))throw Error("examIds必须是试卷编号数组");if(!(p=n._(new Set(t.examIds||[]))).length||p.length>10||p.some(function(e){return"string"!=typeof e||!/^[A-Za-z0-9_-]{1,128}$/.test(e)}))throw Error("每次发布1至10个合法试卷编号");x=(m=require("./exam-model.js")).normalizeSections,_=m.correctFromSections,b=!0,w=!1,y=void 0,eu.label=4;case 4:eu.trys.push([4,9,10,11]),S=p[Symbol.iterator](),eu.label=5;case 5:if(b=(v=S.next()).done)return[3,8];return E=v.value,[4,s.collection("exam_data").doc(E).get()];case 6:if(!(k=eu.sent().data)||k.setKey!==E)throw Error("未找到匹配的试卷："+E);if((I=x(k.sections).reduce(function(e,t){return e+t.count},0))!==k.count||Object.keys(_(k.sections)).length!==I)throw Error("题数或标准答案不完整："+E);l([k]),eu.label=7;case 7:return b=!0,[3,5];case 8:return[3,11];case 9:return N=eu.sent(),w=!0,y=N,[3,11];case 10:try{b||null==S.return||S.return()}finally{if(w)throw y}return[7];case 11:q=!0,T=!1,C=void 0,eu.label=12;case 12:eu.trys.push([12,29,30,31]),j=p[Symbol.iterator](),eu.label=13;case 13:if(q=(A=j.next()).done)return[3,28];M=A.value,P=!1,eu.label=14;case 14:return eu.trys.push([14,16,,17]),[4,s.collection("exam_rank_stats").doc(M).get()];case 15:return P=!!eu.sent().data,[3,17];case 16:if(R=eu.sent(),!/not exist|not found|不存在|cannot find/i.test(String(R.errMsg||R.message||"")))throw R;return[3,17];case 17:if(P)return[3,23];return[4,s.collection("exam_history").where({examId:M}).count()];case 18:if(eu.sent().total)throw Error("已有作答但缺少统计，请先补齐本卷统计："+M);eu.label=19;case 19:return eu.trys.push([19,21,,23]),[4,s.collection("exam_rank_stats").add({data:{_id:M,totalCount:0,scoreRankMap:{},questionStats:{},filteredQuestionStats:{0:{},60:{},70:{},80:{}},updatedAt:0}})];case 20:case 22:return eu.sent(),[3,23];case 21:return eu.sent(),[4,s.collection("exam_rank_stats").doc(M).get()];case 23:return[4,d(M)];case 24:if(!eu.sent())throw Error("答案导出失败："+M);return[4,f(M)];case 25:if(!eu.sent())throw Error("统计导出失败："+M);return[4,h(M,{fixStringScores:!1})];case 26:if(!eu.sent())throw Error("榜单导出失败："+M);eu.label=27;case 27:return q=!0,[3,13];case 28:return[3,31];case 29:return N=eu.sent(),T=!0,C=N,[3,31];case 30:try{q||null==j.return||j.return()}finally{if(T)throw C}return[7];case 31:return[4,g(!0)];case 32:if(!(D=eu.sent()).length)throw Error("目录发布失败");return[2,{success:!0,mode:"publishExams",exams:p,catalogCount:D.length}];case 33:if(U=new Set(["exportPeanut1","exportGuokao1","exportPeanut2","exportShengKao1","exportShengKao2","exportChaogeShengKao","exportChaogeTaojuan","exportHuashengShiyeA"]),F=!c.OPENID&&t&&"Timer"===t.Type&&U.has(t.TriggerName),K=Math.floor((Date.now()+288e5)/864e5),F&&"exportGuokao1"!==t.TriggerName&&K%2!=0)return[2,{success:!0,status:"skipped_48h_schedule"}];if(!(t&&t.examId)&&!F)return console.warn("Rejected autoExportStatic call without examId or trusted timer context"),[2,{success:!1,error:"examId is required"}];if(!(O=t&&t.examId?String(t.examId):"").startsWith("leaderboard:"))return[3,38];if(!(L=O.slice(12).split(",").map(function(e){return e.trim()}).filter(Boolean)).length)throw Error("Missing examId for leaderboard-only export");if(L.length>5)throw Error("Leaderboard-only batches are limited to 5 exams");console.log("[Leaderboard Only] exams=".concat(L.join(","))),z=[],B=0,eu.label=34;case 34:if(!(B<L.length))return[3,37];return[4,Promise.all(L.slice(B,B+2).map(function(t){return e._(function(){var e;return a._(this,function(r){switch(r.label){case 0:return[4,h(t,{fixStringScores:!1})];case 1:return[2,{examId:t,success:!!(e=r.sent()),count:e?e.length:0}]}})})()}))];case 35:Q=eu.sent(),(G=z).push.apply(G,n._(Q)),eu.label=36;case 36:return B+=2,[3,34];case 37:return[2,{success:z.every(function(e){return e.success}),mode:"leaderboardOnly",exams:z}];case 38:if(!(t&&t.examId))return[3,40];return H=String(t.examId),console.log("[Single Export] examId=".concat(H)),[4,Promise.all([d(H),h(H),f(H)])];case 39:return J=($=r._.apply(void 0,[eu.sent(),3]))[0],W=$[1],V=$[2],[2,{success:!!J&&!!W,mode:"single",examId:H,examData:!!J,leaderboard:!!W,rankStats:!!V}];case 40:if("exportGuokao1"!==t.TriggerName)return[3,42];return[4,e._(function(){var e;return a._(this,function(t){switch(t.label){case 0:return t.trys.push([0,3,,4]),[4,s.collection("global_config").doc("app_settings").get()];case 1:return[4,u("global_config.json",(e=t.sent()).data)];case 2:return t.sent(),[2,e.data];case 3:return console.error("Export global config failed",t.sent()),[3,4];case 4:return[2]}})})()];case 41:eu.sent(),eu.label=42;case 42:return[4,g("exportGuokao1"===t.TriggerName)];case 43:return Y=(X=eu.sent())?X.map(function(e){return e.setKey}).filter(function(e){return e}):[],[4,e._(function(){return a._(this,function(e){switch(e.label){case 0:return[4,s.collection("exam_rank_stats").field({_id:!0}).limit(1e3).get()];case 1:return[2,(e.sent().data||[]).map(function(e){return e._id}).filter(Boolean)]}})})()];case 44:if(Z=eu.sent(),ee=n._(new Set(n._(Y).concat(n._(Z)))),console.log("Found ".concat(ee.length," exams to export (Config: ").concat(Y.length,", Statistics: ").concat(Z.length,")")),et=ee,(er=F?t.TriggerName:"")?(console.log("[Trigger Split] Triggered by ".concat(er)),"exportPeanut1"===er?et=ee.filter(function(e){return e.includes("huasheng1qi")||/^fenbi-guokao-jizhi-zhifa-[1-6]$/.test(e)}):"exportGuokao1"===er?et=ee.filter(function(e){return/^26-huashengguokao\d+qi-/.test(e)}):"exportPeanut2"===er?et=ee.filter(function(e){return e.includes("huasheng2qi")}):"exportShengKao1"===er?et=ee.filter(function(e){return e.includes("shengkao1qi")}):"exportShengKao2"===er?et=ee.filter(function(e){return e.includes("shengkao2qi")}):"exportChaogeShengKao"===er?et=ee.filter(function(e){return e.includes("chaoge-shengkao")}):"exportChaogeTaojuan"===er?et=ee.filter(function(e){return e.includes("chaoge-taojuan")}):"exportHuashengShiyeA"===er&&(et=ee.filter(function(e){return e.includes("huasheng-shiye-A")})),console.log("[Trigger Split] Filtered down to ".concat(et.length," exams"))):console.log("[Manual Run] Running full list (or single if specified)"),!(et.length>0))return[3,49];en=Date.now(),ea=88e4,eo=2,es=[],ec=0,ei=0,eu.label=45;case 45:if(!(ei<et.length))return[3,48];if(Date.now()-en>ea)return console.warn("[Time Limit] Execution exceeded ".concat(ea,"ms, stopping early.")),[3,48];return[4,Promise.allSettled(et.slice(ei,ei+eo).map(function(t){return e._(function(){var e,n,s,c,i;return a._(this,function(a){switch(a.label){case 0:if(!t)return[2];console.log("--- Exporting ".concat(t," ---")),a.label=1;case 1:return a.trys.push([1,6,7,8]),[4,o.callFunction({name:"updateRankStats",data:{examId:t},timeout:13e4})];case 2:if(!(n=(e=a.sent())&&e.result&&e.result.details&&e.result.details[0])||!["updated","throttled","skipped_no_valid_scores"].includes(n.status))throw Error("Statistics recalculation failed");if(!(s=!n.cdn))return[3,4];return[4,f(t)];case 3:s=!a.sent(),a.label=4;case 4:if(s)throw Error("Rank snapshot export failed");return[4,Promise.allSettled([d(t),h(t,{fixStringScores:!1})])];case 5:if([(c=r._.apply(void 0,[a.sent(),2]))[0],c[1]].some(function(e){return"fulfilled"!==e.status||!e.value}))throw Error("Snapshot export failed");return[3,8];case 6:return i=a.sent(),console.error("[Scheduled Export] ".concat(t," failed"),i),es.push(t),[3,8];case 7:return ec++,[7];case 8:return[2]}})})()}))];case 46:eu.sent(),eu.label=47;case 47:return ei+=eo,[3,45];case 48:return[2,{success:ec===et.length&&0===es.length,processedCount:ec,totalCount:et.length,failedLeaderboardIds:es}];case 49:return[2,{success:!0}];case 50:return console.error("Auto Export Failed",el=eu.sent()),[2,{success:!1,error:el}];case 51:return[2]}})})()}; 
 			}); 
		define("cloudfunctions/deleteExamRecord/index.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),r=require("../../@swc/runtime/_ts_generator"),s=require("wx-server-sdk");s.init({env:s.DYNAMIC_CURRENT_ENV});var t=s.database();exports.main=function(n,c){return e._(function(){var e,c,i,o;return r._(this,function(r){switch(r.label){case 0:if(e=s.getWXContext().OPENID,!(c=(n||{}).recordId))return[2,{success:!1,errMsg:"recordId is required"}];r.label=1;case 1:return r.trys.push([1,4,,5]),[4,t.collection("exam_history").doc(c).get()];case 2:if(!(i=r.sent().data))return[2,{success:!0,id:c,alreadyGone:!0}];if(i._openid!==e)return[2,{success:!1,errMsg:"permission denied"}];return[4,t.collection("exam_history").doc(c).remove()];case 3:return r.sent(),[2,{success:!0,id:c}];case 4:return[2,{success:!1,errMsg:(o=r.sent())&&o.message?o.message:"unknown error",error:o}];case 5:return[2]}})})()}; 
 			}); 
		define("cloudfunctions/idiomSearch/index.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),r=require("../../@swc/runtime/_ts_generator"),t="https://cloud1-8g137o5da8d5e269-1388442749.ap-shanghai.app.tcloudbase.com/idiom";function n(t,n){return e._(function(){var e,s;return r._(this,function(r){switch(r.label){case 0:e=new AbortController,s=setTimeout(function(){return e.abort()},n),r.label=1;case 1:return r.trys.push([1,,3,4]),[4,fetch(t,{signal:e.signal})];case 2:return[2,r.sent()];case 3:return clearTimeout(s),[7];case 4:return[2]}})})()}exports.main=function(){var s=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return e._(function(){var e,a,o,u,c;return r._(this,function(r){switch(r.label){case 0:e=s.q,a=s.url,r.label=1;case 1:if(r.trys.push([1,8,,9]),!a)return[3,4];return[4,n(t+(s.raw?"/api/raw":"/api/read")+"?url="+encodeURIComponent(a)+"&q="+encodeURIComponent(e||""),55e3)];case 2:if(!(o=r.sent()).ok)throw Error("HTTP "+o.status);return[4,o.json()];case 3:case 6:return[2,{ok:!0,data:r.sent()}];case 4:if(!(e&&String(e).trim()))return[3,7];return[4,n(t+"/api/search?q="+encodeURIComponent(String(e).trim()),55e3)];case 5:if(!(u=r.sent()).ok)throw Error("HTTP "+u.status);return[4,u.json()];case 7:return[2,{ok:!1,error:"参数缺失"}];case 8:return console.error("[idiomSearch]",(c=r.sent())&&c.message),[2,{ok:!1,error:String(c&&c.message||c)}];case 9:return[2]}})})()}; 
 			}); 
		define("cloudfunctions/login/index.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),r=require("../../@swc/runtime/_ts_generator"),t=require("wx-server-sdk");t.init({env:t.DYNAMIC_CURRENT_ENV}),exports.main=function(n,s){return e._(function(){return r._(this,function(e){return[2,{openid:t.getWXContext().OPENID}]})})()}; 
 			}); 
		define("cloudfunctions/updateRankStats/index.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),t=require("../../@swc/runtime/_type_of"),r=require("../../@swc/runtime/_ts_generator"),n=require("wx-server-sdk");n.init({env:n.DYNAMIC_CURRENT_ENV});var s=n.database(),a=s.command;s.command.aggregate;var o=function(e){return/^26-huashengguokao\d+qi-/.test(String(e||""))?24:48};exports.main=function(){var c=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return e._(function(){var i,u;return r._(this,function(f){switch(f.label){case 0:var d;if(i=n.getWXContext(),"policy"===c.operation)return[2,{success:!0,guokaoHours:24,otherHours:48,clientRecalculation:!1}];if(i.OPENID)return[2,{success:!0,status:"scheduled_only",intervalHours:o(c.examId)}];if("string"!=typeof c.examId||!/^[A-Za-z0-9_-]{1,128}$/.test(c.examId))return[2,{success:!1,error:"A single examId is required"}];return[4,(d=c.examId,e._(function(){var c,i,u,f,l,h,_,g,p,m,w,v,y,A,b,x,C,S,E,q,k,N,j,I,D,M,O;return r._(this,function(U){var Q,R;switch(U.label){case 0:U.trys.push([0,18,,19]),i=60*(c=o(d))*6e4,u=function(e){return Math.floor((e+288e5)/i)},U.label=1;case 1:return U.trys.push([1,3,,4]),[4,s.collection("exam_rank_stats").doc(d).get()];case 2:if(Number.isFinite(l=new Date((f=U.sent()).data&&f.data.updatedAt).getTime())&&u(l)>=u(Date.now()))return[2,{examId:d,status:"throttled",intervalHours:c}];return[3,4];case 3:return U.sent(),[3,4];case 4:return[4,s.collection("exam_history").aggregate().match({examId:d,score:a.exists(!0)}).group({_id:"$score",count:{$sum:1}}).limit(5e3).end()];case 5:if(h=U.sent(),_=[],h.list&&(_=h.list.filter(function(e){var t=Number(e._id);return!isNaN(t)&&t>=0})),g=new Map,_.forEach(function(e){var t=Number(e._id),r=g.get(t)||0;g.set(t,r+e.count)}),_=[],g.forEach(function(e,t){_.push({_id:t,count:e})}),_.sort(function(e,t){return Number(t._id)-Number(e._id)}),p=String(d||"").startsWith("26-huasheng-shiye-A")?[0,90,105,120]:[0,60,70,80],0!==_.length)return[3,7];return m={},p.forEach(function(e){m[String(e)]={}}),[4,s.collection("exam_rank_stats").doc(d).set({data:{totalCount:0,scoreRankMap:{},questionStats:{},filteredQuestionStats:m,updatedAt:s.serverDate()}})];case 6:return U.sent(),[2,{examId:d,status:"skipped_no_valid_scores"}];case 7:w=0,v={},y=1,_.forEach(function(e){var t=String(Number(e._id)),r=e.count;v[t]=y,w+=r,y+=r}),A=Math.max(1,Math.ceil(w/1e3)),b={},U.label=8;case 8:return U.trys.push([8,10,,11]),[4,e._(function(){var e,n,a;return r._(this,function(r){switch(r.label){case 0:return e={},[4,s.collection("exam_data").doc(d).field({answers:!0,sections:!0}).get()];case 1:if((n=r.sent().data||{}).answers){if("string"==typeof n.answers)return n.answers.split("").forEach(function(t,r){e["q_".concat(r+1)]=String(t||"").toUpperCase()}),[2,e];if(Array.isArray(n.answers))return n.answers.forEach(function(t,r){e["q_".concat(r+1)]=String(t||"").toUpperCase()}),[2,e];if("object"===t._(n.answers))return Object.keys(n.answers).forEach(function(t){e[String(t).startsWith("q_")?String(t):"q_".concat(String(t).replace("q_",""))]=String(n.answers[t]||"").toUpperCase()}),[2,e]}return Array.isArray(n.sections)&&(a=1,n.sections.forEach(function(t){t.answers?("string"==typeof t.answers?t.answers.split(""):t.answers).forEach(function(t){e["q_".concat(a)]=String(t||"").toUpperCase(),a++}):Array.isArray(t.questions)?t.questions.forEach(function(t){e["q_".concat(a)]=String(t&&t.answer||"").toUpperCase(),a++}):a+=Number(t.count||0)})),[2,e]}})})()];case 9:return b=U.sent(),[3,11];case 10:return x=U.sent(),console.warn("Failed to load exam_data for ".concat(d),x),[3,11];case 11:return C=function(){var e={};return Object.keys(b).forEach(function(t){e[t]={c:0,t:0,distCount:{A:0,B:0,C:0,D:0}}}),e},S={},p.forEach(function(e){S[String(e)]=C()}),E=function(e,t){Object.keys(t).forEach(function(r){var n="q_".concat(r),s=t[r];e[n]||(e[n]={c:0,t:0,distCount:{A:0,B:0,C:0,D:0}}),e[n].t+=1,void 0===e[n].distCount[s]&&(e[n].distCount[s]=0),e[n].distCount[s]+=1,b[n]&&s===b[n]&&(e[n].c+=1)})},[4,(Q=A,R=function(e){return e.forEach(function(e){var r=Number(e.score);if(!isNaN(r)){var n,s,a=(n=function(e,r){if("string"==typeof e.userAnswers||Array.isArray(e.userAnswers)){var n={};return Array.from(e.userAnswers).forEach(function(e,t){"string"==typeof e&&/^[ABCD]$/i.test(e)&&(n["q_".concat(t+1)]=e)}),n}if(e.userAnswers&&"object"===t._(e.userAnswers))return e.userAnswers;var s=e.correctAnswers||r||{},a=e.userWrongAnswers||{},o={};(Array.isArray(e.unansweredQuestions)?e.unansweredQuestions:[]).forEach(function(e){o["q_"+String(e)]=!0});var c=Object.assign({},a);return Object.keys(s).forEach(function(e){void 0!==a[e]||o[e]||(c[e]=String(s[e]||"").toUpperCase())}),c}(e,b),s={},n&&(void 0===n?"undefined":t._(n))==="object"&&Object.keys(n).forEach(function(e){var t=String(e).replace("q_",""),r=String(n[e]||"").trim().toUpperCase();t&&r&&(s[t]=r)}),s);E(S["0"],a);for(var o=1;o<p.length;o++){var c=p[o];r>c&&E(S[String(c)],a)}}})},e._(function(){var e,t,n,o;return r._(this,function(r){switch(r.label){case 0:e=1e3,t=0,n=0,r.label=1;case 1:if(!(n<Q))return[3,4];return[4,s.collection("exam_history").where({examId:d,score:a.exists(!0)}).field({score:!0,userAnswers:!0,userWrongAnswers:!0,unansweredQuestions:!0,correctAnswers:!0}).skip(t).limit(e).get()];case 2:if(0===(o=r.sent().data||[]).length||(R(o),t+=o.length,o.length<e))return[3,4];r.label=3;case 3:return n++,[3,1];case 4:return console.log("[stats] ".concat(d,": read ").concat(t," records (maxPages=").concat(Q,")")),[2,t]}})})())];case 12:return U.sent(),q=function(e){var t={};return Object.keys(e).forEach(function(r){var n=e[r],s=n.t||0,a={};Object.keys(n.distCount).forEach(function(e){var t=n.distCount[e]||0;a[e]=s>0?Math.round(t/s*100):0}),t[r]={acc:s>0?Math.round(n.c/s*100):0,count:s,dist:a,distCount:n.distCount}}),t},k={},p.forEach(function(e){k[String(e)]=q(S[String(e)])}),N=k["0"]||{},[4,s.collection("exam_rank_stats").doc(d).set({data:{totalCount:w,scoreRankMap:v,questionStats:N,filteredQuestionStats:k,updatedAt:s.serverDate()}})];case 13:U.sent(),j=!1,U.label=14;case 14:return U.trys.push([14,16,,17]),I=JSON.stringify({totalCount:w,updateTime:Date.now(),scoreRankMap:v,questionStats:N,filteredQuestionStats:k}),D=Buffer.from(I,"utf8"),[4,n.uploadFile({cloudPath:"exam_data/rank_stats_".concat(d,".json"),fileContent:D})];case 15:return U.sent(),j=!0,[3,17];case 16:return M=U.sent(),console.warn("Upload rank stats to CDN failed for ".concat(d),M),[3,17];case 17:return[2,{examId:d,status:"updated",total:w,cdn:j}];case 18:return O=U.sent(),console.error("Process exam ".concat(d," failed"),O),[2,{examId:d,status:"failed",error:O}];case 19:return[2]}})})())];case 1:return[2,{success:"failed"!==(u=f.sent()).status,processed:1,details:[u]}]}})})()}; 
 			}); 
		define("cloudfunctions/uploadFile/index.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),r=require("../../@swc/runtime/_ts_generator"),s=require("wx-server-sdk");s.init({env:s.DYNAMIC_CURRENT_ENV}),exports.main=function(t,n){return e._(function(){var e,n,c,u;return r._(this,function(r){switch(r.label){case 0:if(e=t.path,n=t.content,!e||!n)return[2,{success:!1,msg:"Missing path or content"}];r.label=1;case 1:return r.trys.push([1,3,,4]),c=Buffer.from(n,"utf-8"),[4,s.uploadFile({cloudPath:e,fileContent:c})];case 2:return[2,{success:!0,fileID:r.sent().fileID}];case 3:return console.error(u=r.sent()),[2,{success:!1,errMsg:u}];case 4:return[2]}})})()}; 
 			}); 
		define("utils/answer-compat.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var r=require("../@swc/runtime/_sliced_to_array"),e=require("../@swc/runtime/_type_of"),n=["A","B","C","D"],t=function(r,e){return Object.prototype.hasOwnProperty.call(r||{},e)},s=function(r){return r&&(void 0===r?"undefined":e._(r))==="object"&&!Array.isArray(r)};function u(r){return!!r&&(!!(t(r,"userAnswers")&&(s(r.userAnswers)||Array.isArray(r.userAnswers)||"string"==typeof r.userAnswers))||!!(s(r.userWrongAnswers)&&Array.isArray(r.unansweredQuestions)))}function o(e,t){var s={},u="string"==typeof e||Array.isArray(e)?Array.from(e,function(r,e){return[e+1,r]}):Object.entries(e||{}),o=!0,a=!1,i=void 0;try{for(var l,c=u[Symbol.iterator]();!(o=(l=c.next()).done);o=!0){var f=r._(l.value,2),y=f[0],A=f[1],w=Number(String(y).replace(/^q_/,"")),d=String(A||"").trim().toUpperCase();Number.isInteger(w)&&w>=1&&w<=t&&n.includes(d)&&(s["q_".concat(w)]=d)}}catch(r){a=!0,i=r}finally{try{o||null==c.return||c.return()}finally{if(a)throw i}}return s}module.exports={hasAnswerPayload:u,restoreUserAnswers:function(r,e,n){if(!u(r))return null;if(t(r,"userAnswers")&&null!=r.userAnswers)return o(r.userAnswers,n);var s=o(r.correctAnswers,n),a=Object.keys(s).length?s:o(e,n),i=o(r.userWrongAnswers,n),l=new Set(r.unansweredQuestions.map(function(r){return Number(String(r).replace(/^q_/,""))})),c=!0,f=!1,y=void 0;try{for(var A,w=Object.keys(r.userWrongAnswers)[Symbol.iterator]();!(c=(A=w.next()).done);c=!0){var d=A.value;l.add(Number(String(d).replace(/^q_/,"")))}}catch(r){f=!0,y=r}finally{try{c||null==w.return||w.return()}finally{if(f)throw y}}for(var p={},_=1;_<=n;_++){var v="q_".concat(_);if(i[v])p[v]=i[v];else if(!l.has(_)&&a[v])p[v]=a[v];else if(!l.has(_))return null}return p},normalizeAnswers:o,encodeAnswers:function(r,e){var n=o(r,e);return Array.from({length:e},function(r,e){return n["q_".concat(e+1)]||"-"}).join("")}}; 
 			}); 
		define("utils/cloud.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_async_to_generator"),r=require("../@swc/runtime/_object_spread"),t=require("../@swc/runtime/_object_spread_props"),n=require("../@swc/runtime/_sliced_to_array"),a=require("../@swc/runtime/_type_of"),s=require("../@swc/runtime/_ts_generator"),o=require("./local-cache.js"),c=require("./history-detail.js"),i=require("./result-session.js"),u=function(){var e=wx.getStorageSync("device_id");return e||(e="dev_"+Date.now()+"_"+Math.random().toString(36).substr(2,9),o.write("device_id",e)),e},l=wx.cloud.database(),d=l.command,f="https://636c-cloud1-8g137o5da8d5e269-1388442749.tcb.qcloud.la/exam_data/",h=(0,require("./static-snapshot.js").createSnapshotReader)(f),_=function(e){var r=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return e?h({key:"leaderboard_snapshot_v5_"+e,file:"leaderboard_"+encodeURIComponent(e)+".json",validate:function(e){return Array.isArray(e)&&e.every(function(e){return e&&(void 0===e?"undefined":a._(e))==="object"&&Number.isFinite(parseFloat(e.score))})},isEmpty:function(e){return Array.isArray(e)&&0===e.length},forceRefresh:r}):Promise.resolve(null)},g=function(e){var r=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return e?h({key:"rank_snapshot_v4_"+e,file:"rank_stats_"+encodeURIComponent(e)+".json",validate:function(e){return!(!e||(void 0===e?"undefined":a._(e))!=="object"||Array.isArray(e)||!Number.isFinite(Number(e.totalCount))||0>Number(e.totalCount)||!e.scoreRankMap||"object"!==a._(e.scoreRankMap)||Array.isArray(e.scoreRankMap))&&(0===Number(e.totalCount)||Object.entries(e.scoreRankMap).some(function(r){var t=n._(r,2),a=t[0],s=t[1];return Number.isFinite(Number(a))&&Number.isInteger(Number(s))&&Number(s)>=1&&Number(s)<=Number(e.totalCount)}))},preferNewer:!0,isEmpty:function(e){return e&&0===Number(e.totalCount)},forceRefresh:r}):Promise.resolve(null)},p=null,m=0,y=0,v=new Set,w=function(e){return(e||[]).filter(function(e){return!v.has(e._id)})};function b(e,n){y++,S.clear(),e&&v.add(e),e&&(c.forget(e),i.remove(e)),p=null,m=0;try{if(wx.removeStorageSync("exam_history_local_cache"),wx.setStorageSync("history_needs_refresh",!0),!e)return;var a=wx.getStorageSync("current_exam_result");if(a&&a._id===e&&wx.removeStorageSync("current_exam_result"),n){var s="leaderboard_cache_".concat(n),o=wx.getStorageSync(s);o&&wx.setStorageSync(s,t._(r._({},o),{historyList:w(o.historyList)}))}if("function"==typeof getApp){var u=getApp(),l=u.globalData&&u.globalData.leaderboardCache,d=!0,f=!1,h=void 0;try{for(var _,g=Object.keys(l||{})[Symbol.iterator]();!(d=(_=g.next()).done);d=!0){var b=_.value;l[b]=t._(r._({},l[b]),{historyList:w(l[b].historyList)})}}catch(e){f=!0,h=e}finally{try{d||null==g.return||g.return()}finally{if(f)throw h}}}}catch(e){}}var x=new Map,S=new Map,D=function(){var r=arguments.length>0&&void 0!==arguments[0]&&arguments[0],t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:0,n=arguments.length>2&&void 0!==arguments[2]&&arguments[2];return e._(function(){var e,a,o;return s._(this,function(s){switch(s.label){case 0:e=(t=Math.max(0,Math.floor(Number(t)||0)))+":"+y,(a=x.get(e))||(a=T(r,t,!0),x.set(e,a)),s.label=1;case 1:return s.trys.push([1,3,4,5]),[4,a];case 2:return[2,s.sent()];case 3:if(o=s.sent(),n)throw o;return[2,[]];case 4:return x.get(e)===a&&x.delete(e),[7];case 5:return[2]}})})()},T=function(r,t,n){return e._(function(){var e,a,c,i,u,d,f,h;return s._(this,function(s){switch(s.label){case 0:if(s.trys.push([0,3,,4]),e=S.get(t),t>0&&!r&&e&&Date.now()-e.ts<6e5)return[2,w(e.list)];if(a=Date.now(),0===t&&!r&&p&&a-m<6e5)return[2,w(p)];if(0===t&&!r&&(c=wx.getStorageSync("exam_history_local_cache"))&&c.list&&a-c.ts<18e5)return p=w(c.list),m=a,[2,p];return i=y,[4,F()];case 1:return u=s.sent(),[4,l.collection("exam_history").where({_openid:u}).orderBy("timestamp","desc").field({_id:!0,examId:!0,score:!0,timestamp:!0,createTime:!0,correctCount:!0,totalQuestions:!0,wrongCount:!0,unansweredCount:!0,rank:!0,percent:!0}).skip(t).limit(20).get()];case 2:if(d=w(s.sent().data),i===y)for(S.set(t,{list:d,ts:a});S.size>5;)S.delete(S.keys().next().value);if(0===t&&i===y){p=d,m=a;try{wx.setStorageSync("exam_history_local_cache",{list:d,ts:a})}catch(e){}}return[2,d];case 3:if(console.error("Cloud fetch failed",f=s.sent()),h=0===t?p||(o.read("exam_history_local_cache")||{}).list:(S.get(t)||{}).list)return[2,w(h)];if(n)throw f;return[2,[]];case 4:return[2]}})})()},C=function(){var r=arguments.length>0&&void 0!==arguments[0]&&arguments[0];return e._(function(){var t,n,a,c,i,u;return s._(this,function(d){switch(d.label){case 0:if(d.trys.push([0,7,,8]),t=Date.now(),n=function(e){return(e?30:5)*6e4},!r&&j&&t-j<n(k))return console.log("Using memory cached user profile"),[2,k];if(!r&&(a=wx.getStorageSync("user_profile_cache"),c=wx.getStorageSync("user_profile_time"),(a||!1===a)&&c&&t-c<n(a)))return console.log("Using storage cached user profile"),k=a||null,j=c,[2,k];if(!E)return[3,2];return[4,E];case 1:return[2,d.sent()];case 2:i=M,E=u=e._(function(){var e,r;return s._(this,function(t){switch(t.label){case 0:return[4,F()];case 1:return e=t.sent(),[4,l.collection("app_users").where({_openid:e}).get()];case 2:return r=t.sent().data.sort(function(e,r){var t=new Date(e.updateTime||e.createTime||0).getTime();return new Date(r.updateTime||r.createTime||0).getTime()-t})[0]||null,i===M&&(k=r,j=Date.now(),o.write("user_profile_cache",r||!1),o.write("user_profile_time",j)),[2,r]}})})(),d.label=3;case 3:return d.trys.push([3,,5,6]),[4,u];case 4:return[2,d.sent()];case 5:return E===u&&(E=null),[7];case 6:return[3,8];case 7:return console.error("Get user profile failed",d.sent()),[2,null];case 8:return[2]}})})()},N="",A=null,k=null,j=0,E=null,M=0,R=function(){M++,E=null,k=null,j=0,o.write("user_profile_time",0)},F=function(){return e._(function(){var r,t,n;return s._(this,function(a){switch(a.label){case 0:if(N)return[2,N];if(r=wx.getStorageSync("openid"))return N=r,[2,r];if(A)return[2,A];A=t=e._(function(){var e;return s._(this,function(r){switch(r.label){case 0:return[4,wx.cloud.callFunction({name:"login"})];case 1:return N=e=r.sent().result.openid,o.write("openid",e),[2,e]}})})(),a.label=1;case 1:return a.trys.push([1,3,4,5]),[4,t];case 2:return[2,a.sent()];case 3:throw console.error("Get OpenID failed",n=a.sent()),n;case 4:return A===t&&(A=null),[7];case 5:return[2]}})})()};module.exports={releaseSnapshotMemory:function(){return h.clearMemory()},saveExamRecord:function(n){return e._(function(){var e,a,o,i,d,f;return s._(this,function(s){switch(s.label){case 0:e=u(),s.label=1;case 1:s.trys.push([1,7,,8]),a={},s.label=2;case 2:return s.trys.push([2,4,,5]),[4,C()];case 3:return(o=s.sent())&&(a={nickName:o.nickname||o.nickName,avatarUrl:o.avatar||o.avatarUrl}),[3,5];case 4:return console.log("Failed to attach user info to record",s.sent()),[3,5];case 5:return i=t._(r._({},n,a),{score:Number(n.score),deviceId:e,createTime:l.serverDate()}),[4,l.collection("exam_history").add({data:i})];case 6:return console.log("Save Record (Simple) - Success, ID:",(d=s.sent())._id),b(),c.remember(t._(r._({},n),{_id:d._id})),[2,d];case 7:throw console.error("Cloud save failed",f=s.sent()),f;case 8:return[2]}})})()},getLeaderboard:function(r){var t=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return e._(function(){var e;return s._(this,function(n){switch(n.label){case 0:return[4,_(r,t)];case 1:return[2,(e=n.sent())?e.slice(0,50):[]]}})})()},fetchLeaderboardSnapshot:_,getLeaderboardCacheTimestamp:function(e){return h.cacheTimestamp("leaderboard_snapshot_v5_"+e)},fetchExamRankStats:g,getAllScores:function(r){return e._(function(){var e,t,n,a;return s._(this,function(s){switch(s.label){case 0:s.trys.push([0,4,,5]),e=[],t=20,n=0,s.label=1;case 1:if(!(n<400))return[3,3];return[4,l.collection("exam_history").where({examId:r,score:d.exists(!0)}).field({score:!0,_openid:!0,timestamp:!0}).orderBy("score","desc").skip(n).limit(t).get()];case 2:if(!(a=s.sent()).data||0===a.data.length||(e=e.concat(a.data),a.data.length<t))return[3,3];return n+=t,[3,1];case 3:return console.log("Fetched ".concat(e.length," scores for stats")),[2,e];case 4:return console.error("Get all scores failed",s.sent()),[2,[]];case 5:return[2]}})})()},getExamHistory:D,filterDeletedHistory:w,getExamCount:function(r){return e._(function(){var e;return s._(this,function(t){switch(t.label){case 0:return[4,g(r)];case 1:return[2,Number((e=t.sent())&&e.totalCount)||0]}})})()},deleteExamRecord:function(r,t){return e._(function(){var n,a,o,c,i,u,d,f;return s._(this,function(h){switch(h.label){case 0:if("string"!=typeof r||!r.trim())throw Error("缺少记录编号，请刷新后重试");n=function(e){return/document[^\n]*(not exist|not found|不存在)|记录不存在/i.test(String(e&&(e.errMsg||e.message)||e||""))},a=function(){return e._(function(){var e,t;return s._(this,function(a){switch(a.label){case 0:return a.trys.push([0,2,,3]),[4,l.collection("exam_history").doc(r).get()];case 1:return[2,!(e=a.sent())||!e.data];case 2:if(t=a.sent(),n(t))return[2,!0];throw t;case 3:return[2]}})})()},h.label=1;case 1:h.trys.push([1,12,,13]),h.label=2;case 2:return h.trys.push([2,4,,5]),[4,wx.cloud.callFunction({name:"deleteExamRecord",data:{recordId:r}})];case 3:return o=h.sent(),[3,5];case 4:return(c=h.sent())&&c.errMsg&&c.errMsg.includes("function not found")||console.warn("Cloud delete failed, falling back to client remove:",c),[3,5];case 5:if(!(o&&o.result))return[3,8];if(!0===o.result.success)return b(r,t),[2,o.result];if(!1!==o.result.success)return[3,8];if(i=o.result.errMsg||"云端未确认删除成功",!(u=n(i)))return[3,7];return[4,a()];case 6:u=h.sent(),h.label=7;case 7:if(u)return b(r,t),[2,{success:!0,alreadyGone:!0,id:r}];throw Error(i);case 8:return[4,l.collection("exam_history").doc(r).remove()];case 9:if(!(!(d=h.sent())||!d.stats||!(d.stats.removed>=1)))return[3,11];return[4,a()];case 10:if(!h.sent())throw Error("删除没有生效，请稍后重试");h.label=11;case 11:return b(r,t),[2,d];case 12:throw console.error("Delete record failed",f=h.sent()),f;case 13:return[2]}})})()},clearExamHistory:function(){return e._(function(){return s._(this,function(e){switch(e.label){case 0:return e.trys.push([0,3,,4]),[4,D()];case 1:return[4,Promise.all(e.sent().map(function(e){return l.collection("exam_history").doc(e._id).remove()}))];case 2:return e.sent(),[2,!0];case 3:return console.error("Cloud clear failed",e.sent()),[2,!1];case 4:return[2]}})})()},saveUserProfile:function(n){return e._(function(){var e,a,o,c,i,u;return s._(this,function(s){switch(s.label){case 0:return s.trys.push([0,9,,10]),[4,F()];case 1:return e=s.sent(),[4,l.collection("app_users").where({_openid:e}).get()];case 2:if(!((a=s.sent()).data.length>0))return[3,6];return c=(o=a.data.sort(function(e,r){var t=new Date(e.updateTime||e.createTime||0).getTime();return new Date(r.updateTime||r.createTime||0).getTime()-t}))[0],i=o.slice(1),console.log("User profile exists, updating:",c._id),[4,l.collection("app_users").doc(c._id).update({data:t._(r._({},n),{updateTime:l.serverDate()})})];case 3:if(s.sent(),!(i.length>0))return[3,5];return console.log("Cleaning up ".concat(i.length," duplicate profiles")),[4,Promise.all(i.map(function(e){return l.collection("app_users").doc(e._id).remove()}))];case 4:s.sent(),s.label=5;case 5:return R(),[2,!0];case 6:return console.log("User profile not found, creating new one"),[4,l.collection("app_users").add({data:t._(r._({},n),{createTime:l.serverDate()})})];case 7:return u=s.sent(),R(),[2,u];case 8:return[3,10];case 9:return console.error("Save user profile failed",s.sent()),[3,10];case 10:return[2]}})})()},clearAvailableExamsCache:function(){h.invalidate("exam_catalog_snapshot_v1"),console.log("Available exams cache cleared")},getUserProfile:C,uploadFile:function(r,t){return e._(function(){var e,n,a,o;return s._(this,function(s){switch(s.label){case 0:return s.trys.push([0,2,,3]),t?e=t.includes("avatars/")?t.replace(/\.[^/.]+$/,"")+".jpg":t:(a=(null==(n=r.match(/\.[^.]+?$/))?void 0:n[0])||".jpg",(e="avatars/"+Date.now()+"-"+Math.random().toString(36).substr(2,9)+a).startsWith("avatars/")&&(e=e.replace(/\.[^/.]+$/,".jpg"))),[4,wx.cloud.uploadFile({cloudPath:e,filePath:r})];case 1:return[2,s.sent().fileID];case 2:throw console.error("Cloud upload failed",o=s.sent()),o;case 3:return[2]}})})()},uploadUserAvatar:function(r){return e._(function(){var e,t,n,a,o,c;return s._(this,function(s){switch(s.label){case 0:return s.trys.push([0,7,,8]),[4,F()];case 1:return e=s.sent(),t="avatars/".concat(e).concat(".jpg"),[4,wx.cloud.uploadFile({cloudPath:t,filePath:r})];case 2:n=s.sent().fileID,s.label=3;case 3:return s.trys.push([3,5,,6]),[4,l.collection("app_users").where({_openid:e}).get()];case 4:return(a=s.sent()).data.length>0&&(o=a.data.sort(function(e,r){var t=new Date(e.updateTime||e.createTime||0).getTime();return new Date(r.updateTime||r.createTime||0).getTime()-t})[0].avatar)&&o.startsWith("cloud://")&&o!==n&&(console.log("Cleaning up old avatar file:",o),wx.cloud.deleteFile({fileList:[o]}).catch(function(e){return console.error("Delete old avatar failed",e)})),[3,6];case 5:return console.error("Cleanup old avatar failed",s.sent()),[3,6];case 6:return[2,n];case 7:throw console.error("Upload user avatar failed",c=s.sent()),c;case 8:return[2]}})})()},getOpenId:F,getUsersBatch:function(r){return e._(function(){var e,t,n,a;return s._(this,function(s){switch(s.label){case 0:if(s.trys.push([0,2,,3]),!r||0===r.length||0===(e=r.filter(function(e){return e&&"string"==typeof e})).length)return[2,[]];return t=l.command,[4,l.collection("app_users").where({_openid:t.in(e)}).get()];case 1:return n=s.sent(),a=new Map,n.data.forEach(function(e){var r=a.get(e._openid);r?new Date(e.updateTime||e.createTime||0).getTime()>new Date(r.updateTime||r.createTime||0).getTime()&&a.set(e._openid,e):a.set(e._openid,e)}),[2,Array.from(a.values())];case 2:return console.error("Batch get users failed",s.sent()),[2,[]];case 3:return[2]}})})()},getAllUsers:function(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:20;return e._(function(){return s._(this,function(e){switch(e.label){case 0:return e.trys.push([0,2,,3]),[4,l.collection("app_users").orderBy("createTime","desc").skip(r).limit(t).get()];case 1:return[2,e.sent().data];case 2:return console.error("Get all users failed",e.sent()),[2,[]];case 3:return[2]}})})()},getTempFileURL:function(r){return e._(function(){var e,t,n,a;return s._(this,function(s){switch(s.label){case 0:if(!r||0===r.length)return[2,[]];if(0===(t=(e=Array.isArray(r)?r:[r]).filter(function(e){return e&&"string"==typeof e&&e.startsWith("cloud://")})).length)return[2,e];s.label=1;case 1:return s.trys.push([1,3,,4]),[4,wx.cloud.getTempFileURL({fileList:t})];case 2:return n=s.sent(),a={},n.fileList.forEach(function(e){a[e.fileID]=e.tempFileURL}),[2,e.map(function(e){return a[e]||e})];case 3:return console.error("Get Temp File URL failed",s.sent()),[2,e];case 4:return[2]}})})()},formatDate:function(e){if(!e)return"";var r=new Date(e);if(isNaN(r.getTime()))return"";var t=r.getFullYear(),n=(r.getMonth()+1).toString().padStart(2,"0"),a=r.getDate().toString().padStart(2,"0"),s=r.getHours().toString().padStart(2,"0"),o=r.getMinutes().toString().padStart(2,"0"),c=r.getSeconds().toString().padStart(2,"0");return"".concat(t,"/").concat(n,"/").concat(a," ").concat(s,":").concat(o,":").concat(c)},syncLocalDataToCloud:function(n){return e._(function(){var e,a,o,c,i;return s._(this,function(s){switch(s.label){case 0:return s.trys.push([0,2,,3]),console.log("Starting sync for",n.length,"exams"),[4,Promise.all(n.map(function(e){var n=Object.assign({},e);return delete n._id,delete n._openid,l.collection("exam_data").doc(e.setKey).set({data:t._(r._({},n),{updateTime:l.serverDate()})}).then(function(){return console.log("Synced: ".concat(e.setKey)),{success:!0,id:e.setKey}}).catch(function(r){return console.error("Failed to sync ".concat(e.setKey,":"),r),{success:!1,id:e.setKey,error:r}})}))];case 1:if(a=(e=s.sent()).filter(function(e){return e.success}).length,console.log("Sync complete. Success: ".concat(a,"/").concat(n.length)),0===a&&n.length>0)return o=e[0].error,c="同步失败",o&&o.errMsg&&o.errMsg.includes("Collection not found")?c="请先在云开发控制台创建 exam_data 集合":o&&(c="同步失败: "+(o.errMsg||o.message||JSON.stringify(o))),[2,{success:!1,error:o,msg:c}];return[2,{success:!0,count:a}];case 2:return console.error("Sync failed",i=s.sent()),[2,{success:!1,error:i,msg:"同步异常: "+(i.errMsg||i.message)}];case 3:return[2]}})})()},getAvailableExams:function(){var r=arguments.length>0&&void 0!==arguments[0]&&arguments[0];return e._(function(){var e,t;return s._(this,function(n){switch(n.label){case 0:return e=require("./exam-catalog.js").validRows,[4,h({key:"exam_catalog_snapshot_v1",file:"available_exams.json",validate:function(r){return e(r)&&r.length>0},forceRefresh:r})];case 1:if(t=n.sent())return[2,t];return[2,require("./real_data.js").map(function(e){return{_id:e._id,setKey:e.setKey,count:e.count}})]}})})()},fetchExamData:function(r){var t=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return e._(function(){var e,n,a,c,i,u,d,h,_,g,p;return s._(this,function(s){switch(s.label){case 0:e="exam_data_".concat(r),n=135*!!/^27-fenbi-guokao-jizhi-[34]$/.test(r),a=function(e){return!n||!!e&&Number(e.count)===n&&!!Array.isArray(e.sections)&&e.sections.reduce(function(e,r){return e+Number(r.count||0)},0)===n&&e.sections.every(function(e){var r=e.answers;return("string"==typeof r||Array.isArray(r))&&r.length===Number(e.count)})},c="force_update_".concat(r),wx.getStorageSync(c)&&(console.log("[Cloud] Detected forced update flag for ".concat(r,", bypassing cache.")),t=!0,wx.removeStorageSync(c)),s.label=1;case 1:if(s.trys.push([1,9,,10]),!f)return[3,7];s.label=2;case 2:return s.trys.push([2,6,,7]),[4,(i=function(e){return new Promise(function(t,a){var s="".concat(f).concat(r,".json")+(e?"?t=".concat(Date.now()):n?"?card=".concat(n):"");wx.request({url:s,method:"GET",timeout:3e3,success:function(e){return 200===e.statusCode&&e.data?t(e.data):a(Error("CDN fetch failed with status ".concat(e.statusCode)))},fail:a})})})(t)];case 3:if(u=s.sent(),!(!a(u)&&!t))return[3,5];return console.warn("[Cloud] Stale question count for ".concat(r,"; retrying CDN with a fresh URL")),[4,i(!0)];case 4:u=s.sent(),s.label=5;case 5:if(!a(u))throw Error("Stale or incomplete exam data: ".concat(r));if(u)return console.log("CDN fetch success"),u.sections&&Array.isArray(u.sections)&&(d=[],u.sections.forEach(function(e){if(e.answers){var r="string"==typeof e.answers?e.answers.split(""):e.answers;d=d.concat(r)}}),d.length>0&&(u.answers=d)),o.write(e,u),[2,u];return[3,7];case 6:return console.warn("CDN fetch failed, falling back to DB:",s.sent()),[3,7];case 7:return console.log("Falling back to Cloud DB..."),[4,l.collection("exam_data").doc(r).get()];case 8:if((h=s.sent()).data&&a(h.data))return h.data.sections&&Array.isArray(h.data.sections)&&(_=[],h.data.sections.forEach(function(e){if(e.answers){var r="string"==typeof e.answers?e.answers.split(""):e.answers;_=_.concat(r)}}),_.length>0&&(h.data.answers=_)),o.write(e,h.data),[2,h.data];return[3,10];case 9:if(g=s.sent(),console.error("Fetch cloud data for ".concat(r," failed"),g),(p=wx.getStorageSync(e))&&a(p))return console.log("Using cached exam data for ".concat(r," (Offline Fallback)")),[2,p];return[2,null];case 10:return[2,null]}})})()},addErrorReport:function(n){return e._(function(){var e;return s._(this,function(a){switch(a.label){case 0:return a.trys.push([0,2,,3]),[4,l.collection("error_reports").add({data:t._(r._({},n),{createTime:l.serverDate(),status:"pending"})})];case 1:return[2,{success:!0,id:a.sent()._id}];case 2:if(console.error("Add report failed",e=a.sent()),-502005===e.errCode)return[2,{success:!1,error:e,msg:"请先在云开发控制台创建 error_reports 集合"}];return[2,{success:!1,error:e}];case 3:return[2]}})})()},getErrorReports:function(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:20;return e._(function(){return s._(this,function(e){switch(e.label){case 0:return e.trys.push([0,2,,3]),[4,l.collection("error_reports").orderBy("createTime","desc").skip(r).limit(t).get()];case 1:return[2,e.sent().data];case 2:return console.error("Get reports failed",e.sent()),[2,[]];case 3:return[2]}})})()},clearCache:function(){S.clear(),N="",R(),p=null,m=0}}; 
 			}); 
		define("utils/data.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_object_spread"),n=require("../@swc/runtime/_object_spread_props"),t=require("../@swc/runtime/_to_consumable_array"),a=require("../@swc/runtime/_type_of"),o=require("./exam-catalog.js"),c=require("./real_data.js"),s=require("./exam-model.js"),i=s.normalizeSections,r=s.correctFromSections,u=[{id:"sec1",name:"政治理论",count:20},{id:"sec2",name:"常识判断",count:15},{id:"sec3",name:"言语理解",count:30},{id:"sec4",name:"数量关系",count:10},{id:"sec5",name:"图形推理",count:10},{id:"sec6",name:"定义判断",count:10},{id:"sec7",name:"类比推理",count:5},{id:"sec8",name:"逻辑判断",count:10},{id:"sec9",name:"资料分析",count:20}],_=[{id:"sec1",name:"政治理论",count:15},{id:"sec2",name:"常识判断",count:10},{id:"sec3",name:"言语理解",count:30},{id:"sec4",name:"数量关系",count:15},{id:"sec5",name:"判断推理",count:30},{id:"sec6",name:"资料分析",count:20}],h=[{id:"sec1",name:"政治理论",count:15},{id:"sec2",name:"常识判断",count:15},{id:"sec3",name:"言语理解",count:30},{id:"sec4",name:"数量关系",count:10},{id:"sec5",name:"判断推理",count:30},{id:"sec6",name:"资料分析",count:20},{id:"sec_extra",name:"附加题(不计分)",count:5}],g=[{id:"sec1",name:"政治理论",count:20},{id:"sec2",name:"常识判断",count:15},{id:"sec3",name:"言语理解",count:30},{id:"sec4",name:"数量关系",count:10},{id:"sec5",name:"判断推理",count:35},{id:"sec6",name:"资料分析",count:20},{id:"sec_extra",name:"附加题(不计分)",count:5}],d=[{id:"sec1",name:"政治理论",count:10},{id:"sec2",name:"常识判断",count:10},{id:"sec3",name:"言语理解",count:30},{id:"sec4",name:"数量关系",count:10},{id:"sec5",name:"判断推理",count:40},{id:"sec6",name:"资料分析",count:20}],l=[{id:"sec1",name:"常识判断",count:20},{id:"sec2",name:"言语理解",count:25},{id:"sec3",name:"数量关系",count:5},{id:"sec4",name:"判断推理",count:35},{id:"sec5",name:"资料分析",count:15}],m=[{id:"sec1",name:"政治理论",count:20},{id:"sec2",name:"常识判断",count:15},{id:"sec3",name:"言语理解",count:30},{id:"sec4",name:"数量关系",count:10},{id:"sec5",name:"判断推理",count:35},{id:"sec6",name:"资料分析",count:20}],p=[{id:"sec1",name:"政治理论",count:20},{id:"sec2",name:"常识判断",count:15},{id:"sec3",name:"言语理解",count:30},{id:"sec4",name:"数量关系",count:15},{id:"sec5",name:"判断推理",count:35},{id:"sec6",name:"资料分析",count:20}],f=function(e){return"peanut_26_guokao_1"===e?"26-huashengguokao1qi":"peanut_25_1"===e?"26-huasheng1qi":"peanut_25_2"===e?"26-huasheng2qi":"peanut_26_shengkao_1"===e?"26-shengkao1qi":"peanut_26_shengkao_2"===e?"26-shengkao2qi":"chaoge_26_shengkao"===e?"26-chaoge-shengkao":"chaoge_27_guokao"===e?"27-chaoge-taojuan":"chaoge_26_taojuan"===e?"26-chaoge-taojuan":"peanut_26_shiye"===e?"26-huasheng-shiye-A":""},k=[{id:"peanut_26_guokao_1",library:"peanut",title:"\uD83E\uDD5C26下半年国考套题一期",color:"#D8C8FF",icon:"\uD83E\uDD5C"},{id:"peanut_26_shiye",library:"peanut",title:"\uD83E\uDD5C26事业单位A类套题",color:"#FFCC99",icon:"\uD83E\uDD5C"},{id:"peanut_26_shengkao_1",library:"peanut",title:"\uD83E\uDD5C26上半年省考季套题一期",color:"#B9FBC0",icon:"\uD83E\uDD5C"},{id:"peanut_26_shengkao_2",library:"peanut",title:"\uD83E\uDD5C26上半年省考季套题二期",color:"#FFE5B4",icon:"\uD83E\uDD5C"},{id:"peanut_25_1",library:"peanut",title:"\uD83E\uDD5C25下半年一期行测套题冲刺卷",color:"#FF9EAA",icon:"\uD83E\uDD5C"},{id:"peanut_25_2",library:"peanut",title:"\uD83E\uDD5C25下半年二期行测套题冲刺卷",desc:"行政+地市-130题",color:"#A2D2FF",icon:"\uD83E\uDD5C"},{id:"chaoge_27_guokao",library:"chaoge",title:"超格27年国考实战卷",color:"#A2D2FF",icon:"\uD83D\uDCD8"},{id:"chaoge_26_shengkao",library:"chaoge",title:"超格26年省考实战卷",color:"#A2D2FF",icon:"\uD83D\uDCD8"},{id:"chaoge_26_taojuan",library:"chaoge",title:"超格26年套卷实战卷",color:"#B9FBC0",icon:"\uD83D\uDCD7"}].map(function(t){return n._(e._({},t),{count:c.filter(function(e){return e.setKey.startsWith(f(t.id))}).length})}),y=function(t){var a=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[],o=[],s="";"peanut_26_guokao_1"===t?s="26-huashengguokao1qi":"peanut_25_1"===t?s="26-huasheng1qi":"peanut_25_2"===t?s="26-huasheng2qi":"peanut_26_shengkao_1"===t?s="26-shengkao1qi":"peanut_26_shengkao_2"===t?s="26-shengkao2qi":"peanut_26_shiye"===t?s="26-huasheng-shiye-A":"chaoge_26_shengkao"===t?s="26-chaoge-shengkao":"chaoge_27_guokao"===t?s="27-chaoge-taojuan":"chaoge_26_taojuan"===t&&(s="26-chaoge-taojuan");var i=c.filter(function(e){return e.setKey.startsWith(s)}).length,r=0;a&&a.length>0&&a.forEach(function(e){if(e.startsWith(s)){var n=e.split("-"),t=parseInt(n[n.length-1]);!isNaN(t)&&t>r&&(r=t)}});var u=i;u="peanut_26_guokao_1"===t||"peanut_26_shengkao_1"===t||"peanut_26_shengkao_2"===t?Math.max(12,i,r):"chaoge_26_shengkao"===t||"chaoge_26_taojuan"===t||"peanut_26_shiye"===t?Math.max(10,i,r):Math.max(i,r);for(var _=1;_<=u;_++)!function(i){var r="",u="",_="".concat(s,"-").concat(i),h=c.some(function(e){return e.setKey===_});!h&&a&&a.length>0&&(h=a.includes(_)),"peanut_26_guokao_1"===t||"peanut_25_1"===t?(r="一期 - 第".concat(i,"套"),u="共130题"):"peanut_25_2"===t?(r="二期 - 第".concat(i,"套"),u="共130题"):"peanut_26_shengkao_1"===t?(r="一期 - 第".concat(i,"套"),u="共120题"):"peanut_26_shengkao_2"===t?(r="二期 - 第".concat(i,"套"),u="共120题"):"chaoge_26_shengkao"===t?(r="省考 - 第".concat(i,"套"),u="共120题"):"peanut_26_shiye"===t?(r="A类-第".concat(i,"套"),u="共100题"):"chaoge_27_guokao"===t?(r="国考 - 第".concat(i,"套"),u=i<=6?"130题＋附加5题":"共120题"):"chaoge_26_taojuan"===t&&(r="实战 - 第".concat(i,"套"),u=i<=6?"共135题":"共120题"),o.push(n._(e._({id:"".concat(t,"_").concat(i),title:r,subTitle:u,examId:_},"chaoge_27_guokao"===t?{hasPdf:!1}:{}),{hasOnlineExam:h}))}(_);return o},b=[];function j(e){o.validRows(e)&&(b=e.filter(function(e){return!e.setKey.startsWith("27-fenbi-")||e.setKey.startsWith("27-fenbi-guokao-jizhi-")}))}function q(){return o.mergeCategories(k,b,f).map(function(t){return"peanut"!==t.library?t:n._(e._({},t),{title:t.title.replace(/花生(?:十三|13)?/g,"\uD83E\uDD5C")})})}module.exports={getCategories:q,setCloudCatalog:j,getPrefix:f,examStructure:u,getExamStructure:function(e){if(!e)return u;if(e.startsWith("27-fenbi-guokao-jizhi-"))return/-[34]$/.test(e)?p:m;var n=c.find(function(n){return n.setKey===e});if(n&&Array.isArray(n.sections)&&n.sections.length)try{return i(n.sections)}catch(e){console.warn("Invalid local structure",e)}if(e.startsWith("26-chaoge-taojuan")){var t=e.split("-"),a=parseInt(t[t.length-1],10);return isNaN(a)?g:a<=6?g:d}return e.startsWith("26-chaoge-shengkao")?h:e.startsWith("26-huasheng-shiye-A")?l:e.startsWith("26-huashengguokao1qi")?m:e.startsWith("26-shengkao1qi")||e.startsWith("26-shengkao2qi")?_:u},categories:k,getPeriods:function(e){var n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[];n.length&&"object"===a._(n[0])&&j(n);var c=t._(new Set(b.map(function(e){return e.setKey}).concat(n.filter(function(e){return"string"==typeof e})))),s=k.some(function(n){return n.id===e})?y(e,c):[];return o.mergePeriods(q().find(function(n){return n.id===e}),s,b)},getCorrectAnswers:function(e){console.log("getCorrectAnswers called with:",e);var n=c.find(function(n){return n.setKey===e});console.log("Found exam:",n?"Yes":"No",n?n.setKey:"");var t={};if(n){if(n.sections&&Array.isArray(n.sections))Object.assign(t,r(n.sections)),console.log("Answers generated from sections:",Object.keys(t).length);else if(n.answers){if("string"==typeof n.answers)for(var a=0;a<n.answers.length;a++)t["q_".concat(a+1)]=n.answers[a];else n.answers.forEach(function(e,n){t["q_".concat(n+1)]=e});console.log("Answers generated from top-level:",Object.keys(t).length)}}else console.warn("Exam data not found for:",e);return t}}; 
 			}); 
		define("utils/event-bus.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_class_call_check"),t=require("../@swc/runtime/_create_class"),s=new(/*#__PURE__*/function(){"use strict";function s(){e._(this,s),this.events={}}return t._(s,[{key:"on",value:function(e,t){this.events[e]||(this.events[e]=[]),this.events[e].push(t)}},{key:"off",value:function(e,t){this.events[e]&&(this.events[e]=this.events[e].filter(function(e){return e!==t}))}},{key:"emit",value:function(e,t){this.events[e]&&this.events[e].forEach(function(e){return e(t)})}}]),s}());module.exports=s; 
 			}); 
		define("utils/exam-catalog.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_object_spread"),t=require("../@swc/runtime/_object_spread_props"),r=require("../@swc/runtime/_to_consumable_array"),i=function(e){return"string"==typeof e&&/^[A-Za-z0-9_-]{1,128}$/.test(e)},n=function(e,t){return"string"==typeof e&&e.trim()&&e.length<=t};function a(e){if(!Array.isArray(e)||e.length>2e3)return!1;var t=new Set;return e.every(function(e){return!(!e||!i(e.setKey)||t.has(e.setKey))&&!!Number.isInteger(e.count)&&!(e.count<1)&&!(e.count>1e3)&&(t.add(e.setKey),!0)})}function o(e){return e&&i(e.id)&&i(e.prefix)&&n(e.title,60)&&["peanut","chaoge","fenbi"].includes(e.library)?{id:e.id,library:e.library,title:e.title.trim(),prefix:e.prefix,color:/^#[0-9a-fA-F]{6}$/.test(e.color)?e.color:"#A2D2FF",icon:n(e.icon,8)?e.icon:"peanut"===e.library?"\uD83E\uDD5C":"\uD83D\uDCD8",sort:Number.isFinite(e.sort)?e.sort:999,isNew:!0===e.isNew}:null}module.exports={validRows:a,normalizeCategory:o,buildAvailableRows:function(e){var t=new Map,r=e.map(function(e){var r={_id:e._id,setKey:e.setKey,count:Number(e.count)},i=e.catalog||{},a=o(i.category);if(a){if(!e.setKey.startsWith(a.prefix+"-"))throw Error("试卷编号与分类前缀不匹配："+e.setKey);var s=t.get(a.id);if(s&&JSON.stringify(s)!==JSON.stringify(a))throw Error("同一分类配置不一致："+a.id);t.set(a.id,a),r._categoryId=a.id}return!1===i.hasPdf&&(r.hasPdf=!1),Number.isInteger(i.extraCount)&&i.extraCount>0&&i.extraCount<r.count&&(r.extraCount=i.extraCount),n(i.displayTitle,40)&&(r.title=i.displayTitle),r});if(!a(r))throw Error("目录编号、题数或重复条目无效");var i=new Set;return r.map(function(e){var r=e._categoryId;return delete e._categoryId,r&&!i.has(r)&&(e.category=t.get(r),i.add(r)),e})},mergeCategories:function(i,n,a){var s=new Map(i.map(function(r,i){return[r.id,t._(e._({},r),{prefix:a(r.id),sort:i})]})),u=!0,l=!1,f=void 0;try{for(var c,d=n[Symbol.iterator]();!(u=(c=d.next()).done);u=!0)!function(){var t=c.value,i=o(t.category);!i||!t.setKey.startsWith(i.prefix+"-")||s.has(i.id)&&s.get(i.id).prefix!==i.prefix||r._(s.values()).some(function(e){return e.id!==i.id&&e.prefix===i.prefix})||s.set(i.id,e._({},s.get(i.id),i))}()}catch(e){l=!0,f=e}finally{try{u||null==d.return||d.return()}finally{if(l)throw f}}return r._(s.values()).map(function(r){var i=new Set(n.filter(function(e){return e.setKey.startsWith(r.prefix+"-")&&/^[1-9]\d*$/.test(e.setKey.slice(r.prefix.length+1))}).map(function(e){return e.setKey}));return t._(e._({},r),{count:Math.max(Number(r.count)||0,i.size)})}).sort(function(e,t){return e.sort-t.sort})},mergePeriods:function(t,i,a){var o=new Map(i.map(function(t){return[t.examId,e._({},t)]}));if(!t||!t.prefix)return r._(o.values());var s=!0,u=!1,l=void 0;try{for(var f,c=a[Symbol.iterator]();!(s=(f=c.next()).done);s=!0){var d=f.value;if(d.setKey.startsWith(t.prefix+"-")){var y=d.setKey.slice(t.prefix.length+1);if(/^[1-9]\d*$/.test(y)){var p=o.get(d.setKey),x=Number(d.extraCount)||0,m=p||{id:t.id+"_"+y,examId:d.setKey,title:"第"+y+"套",subTitle:x?d.count-x+"题＋附加"+x+"题":"共"+d.count+"题"};n(d.title,40)&&(m.title=d.title),!1!==d.hasPdf&&p||(m.hasPdf=!1!==d.hasPdf),m.hasOnlineExam=!0,o.set(d.setKey,m)}}}}catch(e){u=!0,l=e}finally{try{s||null==c.return||c.return()}finally{if(u)throw l}}return r._(o.values()).sort(function(e,t){return Number(e.examId.split("-").pop())-Number(t.examId.split("-").pop())})}}; 
 			}); 
		define("utils/exam-model.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var r=["A","B","C","D"];function e(r){if(!Array.isArray(r)||!r.length)throw Error("试卷章节为空");var e=0,t=r.map(function(r,t){if(!r||!Number.isInteger(Number(r.count))||0>Number(r.count))throw Error("试卷题数无效");var n=Number(r.count);if((e+=n)>1e3)throw Error("试卷题数无效");var i=String(r.name||r.title||"第".concat(t+1,"章"));return{id:r.id||"sec".concat(t+1),name:i,count:n,scored:!1!==r.scored&&"sec_extra"!==r.id&&!/附加|不计分/.test(i)}}).filter(function(r){return r.count>0});if(!e)throw Error("试卷没有题目");return t}module.exports={OPTIONS:r,CARD_COUNT:140,normalizeSections:e,correctFromSections:function(e){var t={},n=0,i=!0,o=!1,a=void 0;try{for(var s,u=(e||[])[Symbol.iterator]();!(i=(s=u.next()).done);i=!0){var c=s.value,l=Number(c.count);if(!Number.isInteger(l)||l<0||n+l>1e3)throw Error("试卷题数无效");for(var f="string"==typeof c.answers?c.answers.split(""):Array.isArray(c.answers)?c.answers:[],d=0;d<l;d++)r.includes(f[d])&&(t["q_".concat(n+d+1)]=f[d]);n+=l}}catch(r){o=!0,a=r}finally{try{i||null==u.return||u.return()}finally{if(o)throw a}}return t},sanitizeAnswers:function(e,t){for(var n={},i=1;i<=t;i++){var o=e&&e["q_".concat(i)];r.includes(o)&&(n["q_".concat(i)]=o)}return n},structureKey:function(r){return JSON.stringify(e(r))},importScan:function(e,t,n){if(!Number.isInteger(n)||n<1||n>140)throw Error("此答题卡最多支持140题");if(!e||e.examId!==t||!e.meta||"OMR-140-v2"!==e.meta.templateId||!Array.isArray(e.items)||140!==e.items.length)throw Error("扫描结果与所选试卷不一致");var i={},o={},a=[],s=0,u=0;return e.items.forEach(function(e,t){if(!e||e.number!==t+1||!["filled","blank","review"].includes(e.status)||("filled"===e.status?!r.includes(e.answer):null!=e.answer))throw Error("扫描结果格式不完整，请重新扫描");if(e.number>n){"filled"===e.status&&s++,"review"===e.status&&u++;return}var c="q_".concat(e.number);"filled"===e.status&&(i[c]=e.answer),"review"===e.status&&(o[c]=!0,a.push({id:c,number:e.number,reason:e.reason||"填涂未读清，请核对纸卡",candidate:r.includes(e.candidate)?e.candidate:""}))}),{answers:i,reviewMap:o,reviewQuestions:a,ignoredFilled:s,ignoredReview:u}},grade:function(t,n,i,o){var a=0,s=0,u=0,c=!0,l=!1,f=void 0;try{for(var d,m=e(i)[Symbol.iterator]();!(c=(d=m.next()).done);c=!0){for(var v=d.value,w=1;w<=v.count;w++)v.scored&&(u++,r.includes(t["q_".concat(a+w)])&&t["q_".concat(a+w)]===n["q_".concat(a+w)]&&s++);a+=v.count}}catch(r){l=!0,f=r}finally{try{c||null==m.return||m.return()}finally{if(l)throw f}}var h=String(o||"").startsWith("26-huasheng-shiye-A")?(1.5*s).toFixed(1):(u?100*s/u:0).toFixed(1);return{correctCount:s,totalQuestions:u,score:h}}}; 
 			}); 
		define("utils/feature-flags.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";module.exports={QUESTION_BANK_ENABLED:!0,COMPACT_HISTORY_WRITES_ENABLED:!1,redirectIfQuestionBankClosed:function(){return!1}}; 
 			}); 
		define("utils/generate_static.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_async_to_generator"),t=require("../@swc/runtime/_object_spread"),r=require("../@swc/runtime/_object_spread_props"),n=require("../@swc/runtime/_to_consumable_array"),o=require("../@swc/runtime/_ts_generator");require("./cloud.js");var a=wx.cloud.database(),c=function(t,r){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:0;return e._(function(){var e,a,s,l;return o._(this,function(o){switch(o.label){case 0:return o.trys.push([0,2,,5]),e=JSON.stringify(r),a="exam_data/".concat(t),[4,wx.cloud.callFunction({name:"uploadFile",data:{path:a,content:e}})];case 1:if((s=o.sent()).result&&s.result.success)return console.log("[Upload Success] ".concat(t," -> ").concat(s.result.fileID)),[2,s.result.fileID];throw Error(s.result?s.result.msg:"Unknown cloud function error");case 2:if(l=o.sent(),console.error("[Upload Error] ".concat(t," (Attempt ").concat(n+1,")"),l),!(n<2))return[3,4];return console.log("Retrying upload for ".concat(t," in 1s...")),[4,new Promise(function(e){return setTimeout(e,1e3)})];case 3:return o.sent(),[2,c(t,r,n+1)];case 4:return[3,5];case 5:return[2]}})})()},s=function(t){return e._(function(){var e,r;return o._(this,function(n){switch(n.label){case 0:return[4,wx.cloud.callFunction({name:"autoExportStatic",data:{examId:t}})];case 1:if(!(r=(e=n.sent())&&e.result)||!0!==r.success)throw Error("Cloud export failed for ".concat(t));return[2,r]}})})()},l=function(){return e._(function(){var e,t,r,n,s,l;return o._(this,function(o){switch(o.label){case 0:o.trys.push([0,7,,8]),e=20,t=1e3,r=[],n=0,o.label=1;case 1:if(!(n<t))return[3,3];return[4,a.collection("exam_data").field({setKey:!0,count:!0}).skip(n).limit(e).get()];case 2:if(l=(s=o.sent())&&s.data?s.data:[],r=r.concat(l),l.length<e)return[3,3];return n+=e,[3,1];case 3:if(console.log("[Available Exams Export] available_exams.json content (".concat(r.length," items):")),!(r.length>0))return[3,5];return[4,c("available_exams.json",r)];case 4:return o.sent(),[3,6];case 5:console.warn("[Available Exams Export] Empty list, skip uploading to avoid wiping cloud list."),o.label=6;case 6:return[2,r];case 7:return console.error("Export available exams failed",o.sent()),[3,8];case 8:return[2]}})})()},u=require("./data.js"),i=u.categories,d=u.getPeriods,f=require("./real_data.js");module.exports={exportExamData:function(n){return e._(function(){var s,l;return o._(this,function(u){switch(u.label){case 0:return u.trys.push([0,5,,6]),[4,e._(function(){var e,c,s;return o._(this,function(o){switch(o.label){case 0:if(!(e=f.find(function(e){return e.setKey===n})))return[3,5];console.log("[Sync] Found local data for ".concat(n,", syncing to Cloud DB...")),o.label=1;case 1:return o.trys.push([1,3,,4]),c=t._({},e),delete c._id,[4,a.collection("exam_data").doc(n).set({data:r._(t._({},c),{updateTime:a.serverDate()})})];case 2:return o.sent(),console.log("[Sync] Cloud DB updated for ".concat(n)),[3,4];case 3:return s=o.sent(),console.warn("[Sync] Cloud DB update failed for ".concat(n," (Non-fatal)"),s),[3,4];case 4:return[2,e];case 5:return o.trys.push([5,7,,8]),[4,a.collection("exam_data").doc(n).get()];case 6:return[2,o.sent().data];case 7:return o.sent(),console.error("[Sync] Data not found locally or in cloud for ".concat(n)),[2,null];case 8:return[2]}})})()];case 1:if(!(s=u.sent()))return[3,3];return l=t._({},s),delete l._id,delete l._openid,l.sections&&Array.isArray(l.sections)&&delete l.answers,console.log("[Exam Data Export] ".concat(n,".json content found (Size: ").concat(JSON.stringify(l).length,")")),[4,c("".concat(n,".json"),l)];case 2:return u.sent(),[2,l];case 3:console.error("[Exam Data Export] No data found for ".concat(n,", skipping upload.")),u.label=4;case 4:return[3,6];case 5:return console.error("Export exam data failed",u.sent()),[3,6];case 6:return[2]}})})()},exportLeaderboard:s,exportRankStats:function(t){return e._(function(){return o._(this,function(e){return console.log("[Rank Stats] Skipped separate call for ".concat(t,", handled in exportLeaderboard")),[2]})})()},exportAvailableExams:l,exportGlobalConfig:function(){return e._(function(){var e;return o._(this,function(t){switch(t.label){case 0:return t.trys.push([0,3,,4]),[4,a.collection("global_config").doc("app_settings").get()];case 1:return e=t.sent(),console.log("[Global Config Export] global_config.json content:"),[4,c("global_config.json",e.data)];case 2:return t.sent(),[2,e.data];case 3:return console.error("Export global config failed",t.sent()),[3,4];case 4:return[2]}})})()},exportAll:function(){return e._(function(){var e,t,r,a,c,u,f,p,_,g,x;return o._(this,function(o){switch(o.label){case 0:return[4,l()];case 1:t=(e=o.sent())?e.map(function(e){return e.setKey}):[],r=[],i.forEach(function(e){var o,a=d(e.id,t);(o=r).push.apply(o,n._(a))}),e&&e.forEach(function(e){r.some(function(t){return t.examId===e.setKey})||(console.log("[DEBUG] Adding cloud-only exam to export list: ".concat(e.setKey)),r.push({examId:e.setKey,name:e.title||e.setKey}))}),console.log("[DEBUG] Categories count: ".concat(i.length)),console.log("[DEBUG] Generated ".concat(r.length," periods from local config.")),console.log("[DEBUG] Exam IDs to export:",JSON.stringify(r.map(function(e){return e.examId}).filter(function(e){return e}))),a=function(e){return new Promise(function(t){return setTimeout(t,e)})},c=!0,u=!1,f=void 0,o.label=2;case 2:o.trys.push([2,8,9,10]),p=r[Symbol.iterator](),o.label=3;case 3:if(c=(_=p.next()).done)return[3,7];if(!(g=_.value.examId))return[3,6];return console.log("--- Exporting ".concat(g," ---")),[4,s(g)];case 4:return o.sent(),[4,a(200)];case 5:o.sent(),o.label=6;case 6:return c=!0,[3,3];case 7:return[3,10];case 8:return x=o.sent(),u=!0,f=x,[3,10];case 9:try{c||null==p.return||p.return()}finally{if(u)throw f}return[7];case 10:return console.log("--- Export Complete ---"),[2]}})})()}}; 
 			}); 
		define("utils/hero-detail.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var r=require("../@swc/runtime/_sliced_to_array"),e=require("../@swc/runtime/_type_of"),n=require("./answer-compat.js"),t=n.hasAnswerPayload,s=n.restoreUserAnswers,u=require("./exam-model.js"),o=u.normalizeSections,c=u.correctFromSections,a=["A","B","C","D"];function i(e,n){var t={},s="string"==typeof e||Array.isArray(e)?Array.from(e,function(r,e){return[e+1,r]}):Object.entries(e||{}),u=!0,o=!1,c=void 0;try{for(var i,l=s[Symbol.iterator]();!(u=(i=l.next()).done);u=!0){var w=r._(i.value,2),m=w[0],f=w[1],A=Number(String(m).replace(/^q_/,"")),v=String(f||"").trim().toUpperCase();Number.isInteger(A)&&A>=1&&A<=n&&a.includes(v)&&(t["q_"+A]=v)}}catch(r){o=!0,c=r}finally{try{u||null==l.return||l.return()}finally{if(o)throw c}}return t}function l(r){var n,u=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(!r||!1===r.answerDetailsAvailable||!t(r))return null;try{n=o(r.examStructure||u.sections||u.examStructure)}catch(r){return null}var a=n.reduce(function(r,e){return r+e.count},0),l=i(r.correctAnswers,a);if(!Object.keys(l).length){var w=!0;if(r.examStructure&&u.sections)try{var m=o(u.sections);w=JSON.stringify(n.map(function(r){return r.count}))===JSON.stringify(m.map(function(r){return r.count}))}catch(r){w=!1}w&&(l=u.sections?c(u.sections):i(u.answers,a))}if(r.userAnswers&&"object"===e._(r.userAnswers)&&!Object.keys(r.userAnswers).length&&(Number(r.correctCount)>0||Number(r.score)>0))return null;var f=s(r,l,a);if(null===f)return null;var A=0,v=0,y=0,d=0,p=0,_=0,b=n.map(function(r){for(var e=0,n=0,t=[],s=0;s<r.count;s++){var u=++A,o="q_"+u,c=f[o],a=l[o],i=c?a?c===a?"correct":"wrong":"unknown":"unanswered";"correct"===i&&e++,"wrong"===i&&n++,r.scored&&(_++,"correct"===i&&v++,"wrong"===i&&y++,"unanswered"===i&&d++,"unknown"===i&&p++),t.push({num:u,status:i,uAns:c||"-",cAns:a||"?"})}return{name:r.name,correct:e,wrong:n,total:r.count,isScoring:r.scored,accuracy:(e/r.count*100).toFixed(0)+"%",questions:t}});return{userAnswers:f,correctAnswers:l,examStructure:n,sectionStats:b,totalQuestions:_,correctCount:v,wrongCount:y,unansweredCount:d,unknownCount:p}}module.exports={buildHeroDetail:l,publicAnswerFields:function(r,e){var n=l(r,e);return n?{userAnswers:n.userAnswers,correctAnswers:n.correctAnswers,examStructure:n.examStructure,answerDetailsAvailable:!0}:{userAnswers:null,correctAnswers:null,answerDetailsAvailable:!1}}}; 
 			}); 
		define("utils/history-detail.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_async_to_generator"),r=require("../@swc/runtime/_object_spread"),t=require("../@swc/runtime/_to_consumable_array"),n=require("../@swc/runtime/_ts_generator"),i=require("./answer-compat.js").hasAnswerPayload,s=require("./local-cache.js"),o="history_detail_recent_v1",a=new Map,u=new Set,c=[],d="";function _(){var e=s.read("openid")||"";if(e!==d&&(d=e,c=[]),!c.length&&d){var r=s.read(o);r&&r.owner===d&&Array.isArray(r.records)&&(c=r.records.slice(0,5).filter(function(e){return!u.has(e._id)}))}}function f(e){if((_(),!(!e||!e._id||!e.examId||!i(e)||u.has(e._id)))&&(!e._openid||e._openid===d)){var r={};for(["_id","_openid","examId","title","mainTitle","subTitle","timestamp","createTime","score","correctCount","totalQuestions","wrongCount","unansweredCount","userAnswers","userWrongAnswers","unansweredQuestions","correctAnswers","examStructure"].forEach(function(t){void 0!==e[t]&&(r[t]=e[t])}),c=[r].concat(t._(c.filter(function(e){return e._id!==r._id}))).slice(0,5);JSON.stringify(c).length>64e3;)c.pop();d&&s.write(o,{owner:d,records:c})}}module.exports={load:function(t,s){return e._(function(){var o,l,h,w;return n._(this,function(m){switch(m.label){case 0:if(!t||!t._id||!t.examId)throw Error("记录编号缺失，请刷新历史记录");if(_(),u.has(t._id))throw Error("这条成绩已删除");if(i(t))return f(t),[2,t];if(o=c.find(function(e){return e._id===t._id&&e.examId===t.examId&&i(e)}))return[2,r._({},o)];if(l=d+":"+t._id,h=d,a.has(l))return[2,a.get(l)];w=e._(function(){var e,r;return n._(this,function(n){switch(n.label){case 0:return n.trys.push([0,,2,3]),[4,Promise.race([Promise.resolve().then(function(){return s(t._id)}),new Promise(function(r,t){e=setTimeout(function(){return t(Error("网络较慢，请稍后重试"))},1e4)})])];case 1:if(r=n.sent(),_(),h!==d)throw Error("登录状态已变更，请重新打开历史记录");if(u.has(t._id))throw Error("这条成绩已删除");if(!r||r._id!==t._id||r.examId!==t.examId||!i(r))throw Error("作答详情未能读取，请刷新后重试");return f(r),[2,r];case 2:return clearTimeout(e),[7];case 3:return[2]}})})(),a.set(l,w),m.label=1;case 1:return m.trys.push([1,,3,4]),[4,w];case 2:return[2,m.sent()];case 3:return a.delete(l),[7];case 4:return[2]}})})()},remember:f,forget:function(e){u.add(e),_(),c=c.filter(function(r){return r._id!==e}),d&&s.write(o,{owner:d,records:c})}}; 
 			}); 
		define("utils/image-export.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_async_to_generator"),t=require("../@swc/runtime/_ts_generator");module.exports={bitmapSize:function(e,t,n){var r=Math.min("details"===n?1:2,4096/e,4096/t,Math.sqrt(4e6/(e*t)));return{width:Math.floor(e*r),height:Math.floor(t*r),scale:r}},createJob:function(){var e=new Set,t={active:!0,phase:"drawing",canvas:null,check:function(){if(!t.active){var e=Error("操作已取消");throw e.cancelled=!0,e}},wait:function(n){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1e4;return t.check(),new Promise(function(t,a){var c=!1,i=function(n,r){c||(c=!0,clearTimeout(u),e.delete(s),n?a(n):t(r))},s=function(){var e=Error("操作已取消");e.cancelled=!0,i(e)},u=setTimeout(function(){return i(Error("处理超时，请重试"))},r);e.add(s);try{n(function(e){return i(null,e)},function(e){return i(e||Error("操作失败"))})}catch(e){i(e)}})},release:function(){if(t.canvas){try{t.canvas.width=1,t.canvas.height=1}catch(e){}t.canvas=null}},cancel:function(){t.active=!1,e.forEach(function(e){return e()}),t.release()}};return t},avatarImage:function(n,r,a){return e._(function(){var e,c;return t._(this,function(t){switch(t.label){case 0:if(!r)return[2,null];t.label=1;case 1:return t.trys.push([1,4,5,6]),[4,a.wait(function(e,t){return wx.getImageInfo({src:r,success:e,fail:t})},1500)];case 2:return c=t.sent(),e=n.createImage(),[4,a.wait(function(t,n){e.onload=function(){return t(e)},e.onerror=n,e.src=c.path},1500)];case 3:return[2,t.sent()];case 4:return t.sent(),a.check(),[2,null];case 5:return e&&(e.onload=null,e.onerror=null),[7];case 6:return[2]}})})()},exportCanvas:function(e,t){return t.wait(function(t,n){return wx.canvasToTempFilePath({canvas:e,x:0,y:0,width:e.width,height:e.height,destWidth:e.width,destHeight:e.height,fileType:"png",success:t,fail:n})})},saveToAlbum:function(n,r){return e._(function(){var e,a,c,i,s;return t._(this,function(t){switch(t.label){case 0:r.phase="saving",e=function(){return r.wait(function(e,t){return wx.saveImageToPhotosAlbum({filePath:n,success:e,fail:t})},6e4)},t.label=1;case 1:return t.trys.push([1,3,,11]),[4,e()];case 2:return t.sent(),[2,!0];case 3:if(a=t.sent(),r.check(),c=String(a&&(a.errMsg||a.message)||""),/cancel/i.test(c))return[2,!1];i=/auth|deny|permission/i.test(c),t.label=4;case 4:return t.trys.push([4,6,,7]),[4,r.wait(function(e,t){return wx.getSetting({success:e,fail:t})})];case 5:return s=t.sent(),i=i||!1===s.authSetting["scope.writePhotosAlbum"],[3,7];case 6:return t.sent(),r.check(),[3,7];case 7:if(!i)throw a;return[4,r.wait(function(e,t){return wx.showModal({title:"相册权限未开启",content:"请在设置中允许保存图片到相册。",confirmText:"去设置",success:e,fail:t})},12e4)];case 8:if(!t.sent().confirm)return[2,!1];return[4,r.wait(function(e,t){return wx.openSetting({success:e,fail:t})},12e4)];case 9:if(!t.sent().authSetting["scope.writePhotosAlbum"])return[2,!1];return[4,e()];case 10:return t.sent(),[2,!0];case 11:return[2]}})})()},drawReportLabel:function(e,t,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{},a=t>=1e3,c=r.fontSize||(a?18:11),i=r.top||(a?31:35),s=a?5:3;e.save(),e.font="600 ".concat(c,"px sans-serif");var u=a?10:7,o=e.measureText(n).width,l=r.centered?(t-(2*s+u+o))/2:r.left||40;e.beginPath(),e.arc(l+s,i+c/2,s,0,2*Math.PI),e.fillStyle="#FFD3B6",e.fill(),e.lineWidth=a?1.5:1,e.strokeStyle="#2C3E50",e.stroke(),e.textAlign="left",e.textBaseline="top",e.fillStyle="#2C3E50",e.fillText(n,l+2*s+u,i),e.restore()}}; 
 			}); 
		define("utils/leaderboard-helper.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_async_to_generator"),r=require("../@swc/runtime/_object_spread"),a=require("../@swc/runtime/_object_spread_props"),t=require("../@swc/runtime/_sliced_to_array"),n=require("../@swc/runtime/_to_consumable_array"),o=require("../@swc/runtime/_ts_generator"),s=require("./cloud.js"),i=s.fetchLeaderboardSnapshot,c=s.getLeaderboardCacheTimestamp,u=s.getExamCount,l=function(e){if(!e)return"";var r=new Date(e);return"".concat(r.getFullYear(),"/").concat(r.getMonth()+1,"/").concat(r.getDate()," ").concat(r.getHours().toString().padStart(2,"0"),":").concat(r.getMinutes().toString().padStart(2,"0"))},m=function(e,t,o,s){var i=e.map(function(e){return r._({},e)});if(!o||!s||null===s.score||void 0===s.score||""===String(s.score).trim()||!Number.isFinite(Number(s.score))||s.examId&&s.examId!==t||s._openid&&s._openid!==o)return i;var c=i.find(function(e){return e._openid===o});if(c&&Number(c.score)>=Number(s.score))return i;var u=a._(r._({},s),{examId:t,_openid:o,_localOnly:!0});return n._(i.filter(function(e){return e._openid!==o})).concat([u])};module.exports={fetchLeaderboardData:function(n,s,_){arguments.length>3&&void 0!==arguments[3]&&arguments[3];var d=arguments.length>4&&void 0!==arguments[4]&&arguments[4],p=arguments.length>5&&void 0!==arguments[5]?arguments[5]:null;return e._(function(){var e,f,v,g,b,w,h,k;return o._(this,function(o){switch(o.label){case 0:return[4,Promise.all([i(n,d),u(n).catch(function(){return 0})])];case 1:if(f=(e=t._.apply(void 0,[o.sent(),2]))[0],v=e[1],null===f)throw Error("Leaderboard snapshot unavailable");return g=f.slice(0,50),b=c(n),g=m(g,n,s,p),w={},k=(h=g.sort(function(e,r){var a=parseFloat(r.score)-parseFloat(e.score);return 0!==a?a:!e._localOnly&&!r._localOnly&&Number(e.rank)>0&&Number(r.rank)>0?Number(e.rank)-Number(r.rank):(e.timestamp?new Date(e.timestamp).getTime():0)-(r.timestamp?new Date(r.timestamp).getTime():0)})).map(function(e,t){return a._(r._({},e),{rank:t+1})}),[2,{leaderboardList:h.slice(0,10).map(function(e,r){var a=e._openid===s,t=e.nickName,o=e.avatarUrl,i=w[e._openid];if(i&&(t=i.nickname||t,o=i.avatar||o),a){var c=_;if(!c||!c.avatarUrl)try{var u=getApp();c=u&&u.globalData&&u.globalData.userInfo?u.globalData.userInfo.profile||u.globalData.userInfo:wx.getStorageSync("userInfo")}catch(e){}c&&(t=c.nickName||c.nickname||t,(c.avatarUrl||c.avatar)&&(o=c.avatarUrl||c.avatar))}return{_id:e._id,rank:r+1,nickName:t,score:e.score,dateStr:l(e.timestamp||e.createTime),avatarUrl:o,isMe:a,_openid:e._openid,userId:e._openid,userAnswers:e.userAnswers,correctAnswers:e.correctAnswers,userWrongAnswers:e.userWrongAnswers,unansweredQuestions:e.unansweredQuestions,examStructure:e.examStructure,answerDetailsAvailable:e.answerDetailsAvailable,timestamp:e.timestamp,correctCount:e.correctCount,totalQuestions:e.totalQuestions,examId:e.examId||n,_localOnly:!!e._localOnly}}),fullRankList:k,rawList:h,totalCount:v,cacheTimestamp:b}]}})})()},mergeLocalScore:m}; 
 			}); 
		define("utils/live-scanner.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../@swc/runtime/_object_spread"),e=require("../@swc/runtime/_object_spread_props"),i=require("./scan-session").ScanSession,o=require("./exam-model").importScan,a=require("./scan-guidance").scanGuidance,r=require("./photo-frame").packPhotoFrame,s=require("./photo-quality").photoQuality,n=require("./torch-preference"),h=n.readTorchPreference,d=n.saveTorchPreference,c=0,u={data:{title:"",examId:"",phase:"idle",cameraPosition:"back",torchEnabled:!1,captureMode:"photo",photoReady:!1,workerReady:!1,photoPreview:"",hint:"请使用行测小助理专用答题卡",progress:0,required:2,gyro:!1,permissionNeeded:!1,privacyVisible:!1,privacyContract:"隐私保护指引",rawError:"",captureStage:"",diagnosticLine:"",diagnosticDetail:"",guideStep:1,guideTitle:"对准四个定位块",guideTip:"让纸卡四个黑色定位块分别靠近四个绿框，题区完整入镜。",markerPresence:[!1,!1,!1,!1],scanVersion:"照片／连续扫描 \xb7 10.10-40",cameraVisible:!1,cameraGeneration:0,cameraBoxStyle:"",systemPhotoSuggested:!1,photoNeedsRetake:!1},onLoad:function(t){this.photoDiagnostics=[];var e=function(t){try{return decodeURIComponent(t||"")}catch(t){return""}},o=Number(t.questionCount),a=e(t.examId);!a||!Number.isInteger(o)||o<1||o>140?this.setData({hint:"当前试卷不支持扫描"}):(this.exam={id:a,count:o,structureKey:this.properties.structureKey,title:e(t.title)},this.returnToExam=!0,this.session=new i,this.setData({title:this.exam.title,examId:a,hint:"本卷"+o+"题，超过题数的填涂会忽略"}))},recordPhotoEvent:function(e){var i=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},o=t._({at:Date.now(),event:e,mode:this.data.captureMode,phase:this.data.phase,torch:!!this.data.torchEnabled,workerReady:!!this.workerReady,frameListener:!!this.listener,cameraVisible:!!this.data.cameraVisible,cameraContext:!!this.camera,generation:this.generation||0},i);this.photoDiagnostics=(this.photoDiagnostics||[]).concat(o).slice(-16)},copyPhotoDiagnostics:function(){var t=this;if(!this._unloaded&&wx.setClipboardData){var e={};try{e=wx.getSystemInfoSync?wx.getSystemInfoSync():{}}catch(t){}var i={scanVersion:this.data.scanVersion,device:e.model||"",system:e.system||"",wechatVersion:e.version||"",SDKVersion:e.SDKVersion||"",quality:this.lastNativePhotoQuality||this.nativePhotoQuality(),resolution:"high",events:this.photoDiagnostics||[]};wx.setClipboardData({data:JSON.stringify(i,null,2),success:function(){!t._unloaded&&wx.showToast&&wx.showToast({title:"拍照诊断已复制",icon:"none"})}})}},onReady:function(){this.exam&&this.start()},start:function(){var t=this;if(!this._unloaded&&!this._hidden&&this.exam&&this.session&&"scanning"!==this.data.phase&&"authorizing"!==this.data.phase){this.nativePhotoRetryCount=0,this.setData({phase:"authorizing",rawError:"",permissionNeeded:!1,hint:"准备小程序相机授权"});var e=this.permissionTicket=(this.permissionTicket||0)+1;wx.getPrivacySetting?wx.getPrivacySetting({success:function(i){e===t.permissionTicket&&"authorizing"===t.data.phase&&(i.needAuthorization?t.setData({privacyVisible:!0,privacyContract:i.privacyContractName||"隐私保护指引",hint:"同意隐私指引后可以使用相机"}):t.authorizeCamera())},fail:function(i){e===t.permissionTicket&&t.permissionError("无法检查隐私授权，请查看下方原因",i)}}):this.authorizeCamera()}},authorizeCamera:function(){var t=this,e=this.permissionTicket,i=function(){e===t.permissionTicket&&"authorizing"===t.data.phase&&t.beginScan()};wx.getSetting({success:function(o){if(e===t.permissionTicket&&"authorizing"===t.data.phase){var a=(o.authSetting||{})["scope.camera"];!0===a?i():!1===a?t.permissionError("请在这个小程序的设置中开启相机",{errMsg:"小程序 scope.camera 尚未授权"}):wx.authorize({scope:"scope.camera",success:i,fail:function(i){e===t.permissionTicket&&t.permissionError("这个小程序还未获得相机权限，请点击下方打开设置",i)}})}},fail:function(i){e===t.permissionTicket&&t.permissionError("无法读取小程序权限，请重试",i)}})},agreePrivacy:function(){"authorizing"===this.data.phase&&this.data.privacyVisible&&(this.setData({privacyVisible:!1}),this.authorizeCamera())},rejectPrivacy:function(){this.permissionTicket++,this.setData({privacyVisible:!1,phase:"idle",hint:"尚未同意隐私指引，扫描未启动"})},openPrivacy:function(){var t=this;wx.openPrivacyContract&&wx.openPrivacyContract({fail:function(e){return t.permissionError("隐私指引暂时无法打开",e)}})},permissionsChanged:function(t){!0===(t.detail&&t.detail.authSetting&&t.detail.authSetting["scope.camera"])?(this.setData({phase:"idle",permissionNeeded:!1}),this.start()):this.permissionError("小程序相机权限仍未开启",{errMsg:"scope.camera=false"})},permissionError:function(t,e){var i=e&&e.errMsg||String(e||"");this.fail(t),this.setData({permissionNeeded:!0,rawError:i})},beginScan:function(t){var e=this;this.cleanup(),this.session.reset();var i=this.generation;if(this.busy=!1,this.workerReady=!1,this.frameId=0,this.lastSent=0,this.gyroMovingUntil=0,this.scanStarted=Date.now(),this.detailMode=!1,this.detailRequested=!1,this.lastDetail=0,this.photoBusy=!1,this.camera=null,this.resultCount=0,this.lastDiagnostics=null,this.lastHintTime=0,this.setData({phase:t?"photoProcessing":"scanning",rawError:"",privacyVisible:!1,permissionNeeded:!1,hint:"相机正在准备，请把四角放进画面",progress:0,saved:!1,photoReady:!1,workerReady:!1,photoPreview:t||"",captureStage:"相机准备中",diagnosticLine:"",diagnosticDetail:""}),t){this.prepareSystemRecognition(t),this.startRecognitionWorker();return}("continuous"!==this.data.captureMode||this.startRecognitionWorker())&&(this.gyroHandler=function(t){Math.hypot(t.x||0,t.y||0,t.z||0)>.5&&(e.gyroMovingUntil=Date.now()+250)},"continuous"===this.data.captureMode&&wx.startGyroscope&&wx.onGyroscopeChange&&(wx.onGyroscopeChange(this.gyroHandler),wx.startGyroscope({interval:"game",success:function(){i===e.generation&&"scanning"===e.data.phase?e.setData({gyro:!0}):wx.stopGyroscope&&wx.stopGyroscope({})},fail:function(){i!==e.generation||e._unloaded||e.setData({gyro:!1})}})),this.noFrameTimer=setTimeout(function(){e.receivedFrame||"scanning"!==e.data.phase||e.setData({hint:"等待相机画面；请在手机微信中打开预览并允许相机"})},6e3))},createRecognitionWorker:function(){var t,e={};try{e=wx.getDeviceInfo?wx.getDeviceInfo():wx.getSystemInfoSync?wx.getSystemInfoSync():{}}catch(t){}var i=/ios|iphone|ipad/i.test([e.platform,e.system,e.model].join(" "));if(this.workerMode=i?"ios-fast":"regular",i)try{t=wx.createWorker("workers/index.js",{useExperimentalWorker:!0})}catch(e){this.workerMode="regular-fallback",this.recordPhotoEvent("worker.fallback",{error:String(e.message||e.errMsg||e).slice(0,300)}),t=wx.createWorker("workers/index.js")}else t=wx.createWorker("workers/index.js");return this.recordPhotoEvent("worker.created",{workerMode:this.workerMode}),t},startRecognitionWorker:function(){var t,e=this,i=this.generation,o=function(){return!e._unloaded&&!e._hidden&&i===e.generation&&t===e.scanWorker};try{t=this.createRecognitionWorker(),this.scanWorker=t,t.onMessage(function(t){if(o()&&["scanning","capturing","photoProcessing"].includes(e.data.phase)&&("photo"!==e.data.captureMode||"result"!==t.type&&"progress"!==t.type||"photo"===t.source)){if("ready"===t.type){if(clearTimeout(e.workerStartTimer),e.workerReady=!0,e.setData({workerReady:!0}),e.photoRetryFrame){var i=e.photoRetryFrame;e.photoRetryFrame=null,e.sendFrame(i,"photo")}else e.resumePhotoRetry(),e.resumeSystemRecognition();return}if("progress"===t.type&&"photo"===t.source&&t.id===e.frameId){e.photoWorkerStage=t.stage,e.recordPhotoEvent("photo.worker",{stage:t.stage,elapsedMs:t.elapsedMs,transferMs:"received"===t.stage?Date.now()-e.workerSentAt:void 0,workerMode:e.workerMode});return}if("result"===t.type&&t.id===e.frameId){if("photo"===t.source&&(e.pendingPhotoFrame=null,e.recordPhotoEvent("photo.result",{code:t.result.code||"OK",markerCount:t.result.markerCount,markerPresence:t.result.markerPresence,optionHeight:t.result.optionHeight,minimumOptionHeight:t.result.minimumOptionHeight,minimumDetailPixels:t.result.minimumDetailPixels,resolutionReviewCount:t.result.resolutionReviewCount,summary:t.result.summary,processingMs:t.result.processingMs,workerMode:e.workerMode})),e.busy=!1,e.lastWorkerMs=Date.now()-e.workerSentAt,clearTimeout(e.workerWatchdog),"FRAME"===t.result.code){e.showDiagnostics(t.result,t.source||"video"),e.fail(t.result.message),e.setData({rawError:"相机像素 "+(t.result.diagnostic||{}).receivedBytes+" / "+(t.result.diagnostic||{}).expectedBytes});return}if("PROCESSING"===t.result.code){e.fail("本地识别计算失败，请查看下方原因"),e.setData({rawError:t.result.rawError});return}if(e.showDiagnostics(t.result,t.source||"video"),"photo"===t.source&&!t.result.ok)return void e.fail("照片未能识别："+t.result.message);if("photo"===t.source&&s(t.result,e.exam.count).needsRetake)return void e.reviewIncompletePhoto(t.result);e.accept(t.result,t.source||"video"),(e.detailMode||e.detailRequested)&&"scanning"===e.data.phase&&e.scheduleDetail()}}}),t.onError&&t.onError(function(t){if(o()){var i=t&&(t.error||t);e.recordPhotoEvent("worker.error",{error:String(i&&i.message||i&&i.errMsg||i).slice(0,500)}),e.fail("本地识别未能启动，请查看下方原因"),e.setData({rawError:i&&i.message||i&&i.errMsg||String(i)})}}),t.onProcessKilled&&t.onProcessKilled(function(){o()&&e.recognitionWorkerKilled(t)})}catch(t){return this.fail("当前微信未能启动本地识别，请查看下方原因"),this.setData({rawError:t&&t.message||t&&t.errMsg||String(t)}),!1}return this.workerStartTimer=setTimeout(function(){o()&&!e.workerReady&&e.fail("识别线程启动超时，请重试")},"photo"===this.data.captureMode?Math.max(1,(this.photoProcessingDeadline||Date.now()+5e3)-Date.now()):1e4),!0},recognitionWorkerKilled:function(t){this.recordPhotoEvent("worker.killed",{workerMode:this.workerMode,restarts:this.workerRestartCount||0});var e=this.pendingPhotoFrame,i=(this.photoProcessingDeadline||0)-Date.now();if("photo"!==this.data.captureMode||!e||(this.workerRestartCount||0)>=1||i<400)return void this.fail("识别线程被系统回收，请重新拍照或扫描");this.workerRestartCount=(this.workerRestartCount||0)+1,this.photoRetryFrame=e,clearTimeout(this.workerWatchdog),clearTimeout(this.workerStartTimer),this.scanWorker=null,this.workerReady=!1,this.busy=!1;try{t.terminate()}catch(t){}this.setData({workerReady:!1}),this.startRecognitionWorker()},cameraReady:function(t){var e=this;if(!this._unloaded&&!this._hidden){var i=t&&t.currentTarget&&t.currentTarget.dataset&&t.currentTarget.dataset.generation;if((this.recordPhotoEvent("camera.initdone",{eventGeneration:void 0===i?null:Number(i)}),void 0===i||Number(i)===this.generation)&&"scanning"===this.data.phase&&!this.camera){var o=this.generation;if(this.camera=wx.createCameraContext(),this.setData({photoReady:this.canReadPhoto()}),"photo"===this.data.captureMode)return(clearTimeout(this.noFrameTimer),this.canReadPhoto())?(this.setData({guideTitle:"对准纸卡后点击拍照",guideTip:"四个定位块和全部题区留在画面内，拍下后可以放下手机。"}),void this.resumePhotoRetry()):void this.fail("当前微信暂不支持照片识别，请切换连续扫描或升级微信");if(this.setData({captureStage:"连续视频检测中"}),!this.camera.onCameraFrame)return void(this.canReadPhoto()?(this.detailRequested=!0,this.scheduleDetail(250)):this.fail("当前微信无法读取相机画面，请在手机微信中重试或升级微信"));this.listener=this.camera.onCameraFrame(function(t){if(o===e.generation&&!e.detailMode&&!e.detailRequested){if(e.receivedFrame=!0,e.workerReady&&!e.busy&&!e.photoBusy&&"scanning"===e.data.phase){var i=Date.now();i<e.gyroMovingUntil&&i-e.scanStarted<750?e.updateHint("稳住手机，正在等清晰画面",e.session.frames.length):i-e.lastSent<280||(e.lastSent=i,e.sendFrame(t,"video"))}}}),this.listener.start({fail:function(t){o===e.generation&&(e.canReadPhoto()?(e.detailRequested=!0,e.scheduleDetail(150)):(e.fail("视频读取失败，请在手机微信中重试或升级微信"),e.setData({rawError:t&&t.errMsg||String(t)})))}}),this.canReadPhoto()&&this.scheduleDetail(2200)}}},sendFrame:function(t,e){var i=this;if("photo"!==this.data.captureMode||"photo"===e){this.busy=!0,this.frameId++,this.workerSentAt=Date.now(),this.setData({captureStage:"photo"===e?"照片判读中":"detail"===e?"本地清晰画面判读中":"连续画面判读中"});var o=this.generation,a=this.scanWorker,r="photo"===e?Math.max(1,(this.photoProcessingDeadline||Date.now()+5e3)-Date.now()):12e3;"photo"===e&&(this.pendingPhotoFrame=t,this.photoWorkerStage="sending",this.recordPhotoEvent("photo.sent",{width:t.width,height:t.height,bytes:t.data.byteLength,format:t.format||"rgba8",budgetMs:r,workerMode:this.workerMode})),this.workerWatchdog=setTimeout(function(){o===i.generation&&a===i.scanWorker&&("photo"===e&&i.recordPhotoEvent("worker.timeout",{stage:i.photoWorkerStage,elapsedMs:Date.now()-i.workerSentAt,workerMode:i.workerMode}),i.fail("photo"===e?"照片识别超时，请重新拍照":"识别线程未响应，请重新开始扫描"))},r);try{a.postMessage({type:"frame",source:e,id:this.frameId,frame:{width:t.width,height:t.height,format:t.format,data:t.data}})}catch(t){this.fail("识别画面传递失败，请重试"),this.setData({rawError:t.message||String(t)})}}},showDiagnostics:function(i,o){this.resultCount++;var r=i.code||"OK",s=i.inputSize||[],n=void 0===i.markerCount?4*!!i.corners:i.markerCount;this.lastDiagnostics={source:o,inputSize:s,code:r,markerCount:n,summary:i.summary,diagnostic:i.diagnostic};var h=i.summary;this.setData(e._(t._({},a(i)),{diagnosticLine:"定位 "+n+"/4 \xb7 "+("detail"===o?"清晰":"视频")+" "+s.join("\xd7")+" \xb7 "+(({FRAME:"画面准备",MARKERS:"读取定位块",DUPLICATE:"纸卡定位",ALIGNMENT:"透视校正",SIZE:"画面分辨率",LIGHT:"光线检查",GRID:"题区校正",CLARITY:"填涂清晰度",OK:"本次判读完成"})[r]||r),diagnosticDetail:h?"已读 "+h.filled+" \xb7 空白 "+h.blank+" \xb7 待确认 "+h.review:i.diagnostic&&void 0!==i.diagnostic.boundary?"第 "+(i.diagnostic.boundary+1)+" 条题区线，可用段 "+i.diagnostic.usableNodes+"/10":"",captureStage:"已检查 "+this.resultCount+" 个画面"}))},scheduleDetail:function(t){var e=this;clearTimeout(this.detailTimer);var i=this.generation;this.detailTimer=setTimeout(function(){if(i===e.generation&&"scanning"===e.data.phase){e.detailRequested=!0;var t=Date.now(),o=t<e.gyroMovingUntil&&t-(e.lastDetail||e.scanStarted)<750;if(!e.workerReady||e.busy||e.photoBusy||o){o&&e.updateHint("稳住手机，正在等清晰画面",e.session.frames.length),e.scheduleDetail(150);return}e.captureDetail()}},void 0===t?Math.max(80,600-(Date.now()-this.lastDetail)):t)},canReadPhoto:function(){return!!(wx.createOffscreenCanvas&&this.camera&&this.camera.takePhoto)},nativePhotoQuality:function(){var t={};try{t=wx.getDeviceInfo?wx.getDeviceInfo():wx.getSystemInfoSync?wx.getSystemInfoSync():{}}catch(t){}return/android/i.test([t.platform,t.system].join(" "))?"original":"high"},capturePhoto:function(){var e=this;if(!this._unloaded&&!this._hidden&&!this.photoLayoutPending&&"photo"===this.data.captureMode&&"scanning"===this.data.phase){if(!this.data.photoReady||this.busy||this.photoBusy||!this.canReadPhoto())return void this.fail("相机还未准备完成，请重新开启拍照");if(!wx.createSelectorQuery)return void this.captureDetail("photo");var i=this.generation;this.photoLayoutPending=!0;var o=function(){return e.photoLayoutPending&&!e._unloaded&&!e._hidden&&i===e.generation&&"photo"===e.data.captureMode&&"scanning"===e.data.phase},a=function(t){o()&&(e.photoLayoutPending=!1,clearTimeout(e.photoLayoutWatchdog),e.photoCameraBox=null,e.setData({cameraBoxStyle:""}),e.recordPhotoEvent("camera.layout.abort",{reason:t}),wx.showToast&&wx.showToast({title:"取景区域正在准备，请稍后再拍",icon:"none"}))},r=function(t){return wx.createSelectorQuery().select(".continuous-camera-box").boundingClientRect(t).exec()};this.photoLayoutWatchdog=setTimeout(function(){return a("timeout")},1200);try{r(function(i){if(o()){if(!i||!Number.isFinite(i.width)||!Number.isFinite(i.height)||i.width<=0||i.height<=0)return void a("empty");e.recordPhotoEvent("camera.layout",{stage:"before",width:i.width,height:i.height}),e.setData({cameraBoxStyle:"box-sizing:border-box;flex:0 0 auto;width:"+i.width+"px;height:"+i.height+"px;min-height:"+i.height+"px;"},function(){if(o())try{r(function(r){if(o()){if(!r||!Number.isFinite(r.width)||!Number.isFinite(r.height)||Math.abs(r.width-i.width)>.5||Math.abs(r.height-i.height)>.5)return void a("changed");e.photoCameraBox={width:r.width,height:r.height},e.recordPhotoEvent("camera.layout",t._({stage:"locked"},e.photoCameraBox)),e.photoLayoutPending=!1,clearTimeout(e.photoLayoutWatchdog),e.captureDetail("photo")}})}catch(t){a("measure")}})}})}catch(t){a("measure")}}},resumePhotoRetry:function(){this.retryPhotoOnReady&&!this._unloaded&&!this._hidden&&"scanning"===this.data.phase&&this.data.photoReady&&(this.retryPhotoOnReady=!1,this.capturePhoto())},retryNativePhoto:function(t,e){var i=this;if(!this._unloaded&&!this._hidden){if(this.recordPhotoEvent(e?"native.failure":"native.timeout",{error:e?String(e.errMsg||e.message||e).slice(0,500):"",errCode:e&&(void 0===e.errCode?e.errno:e.errCode),elapsedMs:this.nativeCaptureStarted?Date.now()-this.nativeCaptureStarted:null}),(wx.chooseMedia||wx.chooseImage)&&this.nativePhotoRetryCount>=1){this.fail("相机未能拍下照片，请使用系统相机拍照"),this.setData({systemPhotoSuggested:!0,rawError:""});return}if(this.nativePhotoRetryCount>=1){this.fail(t),e&&this.setData({rawError:e.message||e.errMsg||String(e)});return}this.nativePhotoRetryCount=(this.nativePhotoRetryCount||0)+1,this.cleanup(),this.retryPhotoOnReady=!0;var o=this.generation;this.setData({phase:"authorizing",rawError:"",hint:"相机拍照未响应，正在重新准备相机"},function(){o!==i.generation||i._unloaded||i._hidden||"authorizing"!==i.data.phase||i.beginScan()})}},captureSystemPhoto:function(){var i=this;if(!this._unloaded&&!this._hidden&&!this.photoLayoutPending&&!this.systemPhotoPending&&"photo"===this.data.captureMode&&["idle","scanning"].includes(this.data.phase)){if(!wx.createOffscreenCanvas||!wx.chooseMedia&&!wx.chooseImage)return void this.fail("当前微信无法使用系统拍照，请切换连续扫描");this.cleanup(),this.session.reset(),this.recordPhotoEvent("system.open",{captureProvider:"system",originalRequested:!0});var o=this.systemPhotoTicket,a=function(){return!i._unloaded&&o===i.systemPhotoTicket&&"photo"===i.data.captureMode};this.systemPhotoPending=!0,this.setData({phase:"capturing",cameraVisible:!1,systemPhotoSuggested:!0,photoPreview:"",rawError:"",guideStep:2,guideTitle:"请在系统相机中拍照",guideTip:"拍下并确认照片后，自动返回识别。"},function(){if(a()){if(i._hidden){i.systemPhotoPending=!1,i.fail("拍照已暂停，可以重新拍摄");return}var o=!1,r="",s=function(t){!o&&a()&&(o=!0,i.systemPhotoPending=!1,i.fail(/cancel|取消/i.test(t&&t.errMsg||"")?"已取消拍照，可以重新拍摄":"系统相机未能打开，请重试或切换连续扫描"))},n={count:1,sourceType:["camera"],sizeType:["original"],camera:"back",success:function(t){var e=t&&t.tempFiles&&t.tempFiles[0],s=e&&e.tempFilePath||t&&t.tempFilePaths&&t.tempFilePaths[0];if(o){s!==r&&i.removePhotoFile(s);return}if(o=!0,r=s,!a())return void i.removePhotoFile(s);if(i.recordPhotoEvent("system.success",{hasPhoto:!!s}),i.systemPhotoPending=!1,"string"!=typeof s||!s)return void i.fail("未取得拍摄的照片，请重新拍照");if(i._hidden){i.pendingSystemPhoto=s;return}i.beginScan(s)},fail:s};try{wx.chooseMedia?wx.chooseMedia(e._(t._({},n),{mediaType:["image"]})):wx.chooseImage(n)}catch(t){s(t)}}})}},removePhotoFile:function(t){"string"==typeof t&&t&&wx.getFileSystemManager&&wx.getFileSystemManager().unlink({filePath:t,fail:function(){}})},reviewIncompletePhoto:function(t){var e=s(t,this.exam.count),i=this.photoPath,o=this.photoCleanup;this.recordPhotoEvent("photo.needs-retake",{filled:e.filled,review:e.review}),this.photoCleanup=null,this.cleanup(),this.photoPath=i,this.photoCleanup=o,this.setData({phase:"idle",photoNeedsRetake:!0,systemPhotoSuggested:!0,photoPreview:i||"",hint:"照片有较多题目未读清：已读 "+e.filled+" 题，待核对 "+e.review+" 题。建议重新拍照。"})},prepareSystemRecognition:function(t){var e=this,i=this.generation,o=!1;this.photoPath=t,this.photoCleanup=function(){o||(o=!0,e.removePhotoFile(t))},this.photoProcessingDeadline=Date.now()+5e3,this.systemPhotoRendered=!1,this.systemPhotoDecodePending=!0,this.setData({phase:"photoProcessing",cameraVisible:!1,photoPreview:t,guideStep:2,guideTitle:"已拍下，可以放下手机",guideTip:"正在识别照片，完成后显示全部答案。"},function(){e._unloaded||e._hidden||i!==e.generation||(e.systemPhotoRendered=!0,e.resumeSystemRecognition())})},resumeSystemRecognition:function(){var t=this;if(this.systemPhotoDecodePending&&this.systemPhotoRendered&&this.workerReady&&!this._unloaded&&!this._hidden&&"photoProcessing"===this.data.phase){this.systemPhotoDecodePending=!1;var e=this.generation,i=this.photoPath,o=function(){return!t._unloaded&&!t._hidden&&e===t.generation&&"photoProcessing"===t.data.phase};this.photoProcessingDeadline=this.photoProcessingDeadline||Date.now()+5e3,this.detailMode=!0,this.photoBusy=!0,this.photoWatchdog=setTimeout(function(){o()&&t.fail("照片读取超时，请重新拍照")},Math.max(1,this.photoProcessingDeadline-Date.now())),this.photoRenderTimer=setTimeout(function(){if(t.photoRenderTimer=null,o()){var e,a,s=function(e){o()&&(t.fail("本地照片读取失败，请重新拍摄"),t.setData({rawError:e&&e.message||e&&e.errMsg||String(e)}))};try{a=(e=wx.createOffscreenCanvas({type:"2d",width:1,height:1})).createImage()}catch(t){s(t);return}var n=!1,h=Date.now();a.onload=function(){if(!n&&o()){n=!0;try{if(!a.width||!a.height)throw Error("照片宽高为零");t.recordPhotoEvent("photo.decoded",{width:a.width,height:a.height});var i=Math.min(1,2560/Math.max(a.width,a.height));e.width=Math.round(a.width*i),e.height=Math.round(a.height*i);var d=e.getContext("2d");d.drawImage(a,0,0,e.width,e.height);var c=d.getImageData(0,0,e.width,e.height);t.lastDecodeMs=Date.now()-h;var u=r(e.width,e.height,c.data);t.lastDecodeMs=Date.now()-h,t.photoBusy=!1,clearTimeout(t.photoWatchdog),t.sendFrame(u,"photo")}catch(t){s(t)}}},a.onerror=function(t){n||(n=!0,s(t))};try{a.src=i}catch(t){s(t)}}},0)}},setCaptureMode:function(t){var e=this;if(!(!["photo","continuous"].includes(t)||t===this.data.captureMode||["capturing","photoProcessing","authorizing"].includes(this.data.phase))&&!this._unloaded){this.retryPhotoOnReady=!1,this.stop(),this.setData({captureMode:t});var i=this.permissionTicket,o=function(){i!==e.permissionTicket||e._unloaded||e._hidden||e.start()};wx.nextTick?wx.nextTick(o):o()}},captureDetail:function(){var t=this,e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"detail";if("scanning"===this.data.phase&&("photo"===e||this.workerReady)&&!this.busy&&!this.photoBusy&&this.canReadPhoto()){var i="photo"===e,o=this.generation;clearTimeout(this.detailTimer),this.photoBusy=!0,this.detailRequested=!1,this.lastDetail=Date.now(),!this.detailMode&&(this.detailMode=!0,this.session.reset(),this.listener&&(this.listener.stop(),this.listener=null)),this.receivedFrame=!0,clearTimeout(this.noFrameTimer),this.setData(i?{phase:"capturing",guideStep:2,guideTitle:"正在拍照，请稍停一下",guideTip:"拍下后会提示你可以放下手机。"}:{captureStage:"自动取得清晰画面"}),i||this.lastDiagnostics||this.updateHint("正在读取清晰画面，请稍停一下",0);var a=function(){return!t._unloaded&&!t._hidden&&o===t.generation&&["scanning","capturing","photoProcessing"].includes(t.data.phase)},r=function(){o===t.generation&&(t.photoBusy=!1,clearTimeout(t.photoWatchdog))},s=function(e,i){a()&&(r(),t.fail(e),i&&t.setData({rawError:i.message||i.errMsg||String(i)}))};this.photoWatchdog=setTimeout(function(){a()&&(i?t.retryNativePhoto("相机拍照没有响应，请重拍或切换连续扫描"):s("相机读取照片超时，请重新开始"))},i?this.nativePhotoRetryCount?4e3:3500:1e4);var n=Date.now(),h=i?this.nativePhotoQuality():"high";i&&(this.lastNativePhotoQuality=h,this.nativeCaptureStarted=n,this.recordPhotoEvent("native.request",{quality:h,startedAt:n,cameraBox:this.photoCameraBox||null}));var d=!1,c="",u={quality:h,success:function(h){h=h||{},i&&t.recordPhotoEvent("native.success",{elapsedMs:Date.now()-n,hasPhoto:!!h.tempImagePath,callbackGeneration:o});var u=Date.now(),l=!1,g=function(){!l&&(l=!0,wx.getFileSystemManager&&h.tempImagePath&&wx.getFileSystemManager().unlink({filePath:h.tempImagePath,fail:function(){}}))};if(d){h.tempImagePath!==c&&g();return}if(!a()){r(),g();return}if(d=!0,c=h.tempImagePath,t.lastCaptureMs=Date.now()-n,"string"!=typeof h.tempImagePath||!h.tempImagePath)return void s("没有取得照片，请重新拍照");if(i){r(),t.beginScan(h.tempImagePath);return}!function(){if(!a()){r(),g();return}try{n=(o=wx.createOffscreenCanvas({type:"2d",width:1,height:1})).createImage()}catch(e){r(),g(),t.fail("照片读取失败，请重新拍摄"),t.setData({rawError:e.message||String(e)});return}var o,n,d=!1;n.onload=function(){if(!d){d=!0;try{if(!a())return;if(!n.width||!n.height)throw Error("相机图片宽高为零");var s=Math.min(1,(i?2560:1920)/Math.max(n.width,n.height));o.width=Math.round(n.width*s),o.height=Math.round(n.height*s);var h=o.getContext("2d");h.drawImage(n,0,0,o.width,o.height);var c=h.getImageData(0,0,o.width,o.height);t.lastDecodeMs=Date.now()-u,t.sendFrame({width:o.width,height:o.height,data:c.data.buffer},e)}catch(e){t.fail("本地照片读取失败，请重新拍摄"),t.setData({rawError:e.message||String(e)})}finally{r(),i&&a()||g()}}},n.onerror=function(e){d||(d=!0,r(),g(),a()&&(t.fail("照片解码失败，请重新拍摄"),t.setData({rawError:e&&e.errMsg||String(e)})))};try{n.src=h.tempImagePath}catch(t){r(),g(),s("照片读取失败，请重新拍摄",t)}}()},fail:function(e){!d&&a()&&(d=!0,i?t.retryNativePhoto("相机未能拍下照片，请重拍或切换连续扫描",e):s("相机未能拍下照片，请重新开启拍照",e))}};try{(i?wx.createCameraContext():this.camera).takePhoto(u)}catch(t){u.fail(t)}}},cameraError:function(t){var e=t&&t.detail||{};this.recordPhotoEvent("camera.error",{error:String(e.errMsg||e.errmsg||e.message||"").slice(0,500)});var i=t&&t.currentTarget&&t.currentTarget.dataset&&t.currentTarget.dataset.generation;if(!this._hidden&&!this._unloaded&&(void 0===i||Number(i)===this.generation)&&"photoProcessing"!==this.data.phase){var o=t&&t.detail||{},a=o.errMsg||o.errmsg||o.message||JSON.stringify(o),r=/auth|permission|授权|权限|拒绝|deny/i.test(a);this.fail(/未找到摄像头|no camera|not found/i.test(a)?"当前设备未找到摄像头，请用手机微信预览":"相机未能打开，请查看下方微信返回的原因"),this.setData({permissionNeeded:r,rawError:a})}},accept:function(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"video";if(!this.detailMode||"video"!==e){var i=this.session.push(t,!1,e);if(i.locked){var a={templateId:i.result.templateId,stableFrames:i.result.stableFrames,frameSource:i.result.frameSource,processingMs:i.result.processingMs,sideAnchorsUsed:i.result.sideAnchorsUsed,totalScanMs:Date.now()-this.scanStarted,captureMs:this.lastCaptureMs,decodeMs:this.lastDecodeMs,workerRoundTripMs:this.lastWorkerMs,scannedAt:new Date().toISOString()},r={examId:this.exam.id,items:i.result.items,meta:a};this.cleanup(),this.setData({phase:"done",hint:"识别完成，正在回填答案"}),wx.vibrateShort&&wx.vibrateShort({type:"light"});try{r.meta.structureKey=this.exam.structureKey,r.meta.questionCount=this.exam.count,o(r,this.exam.id,this.exam.count),this.triggerEvent("complete",r)}catch(t){this.fail("答案未能回填，请重新扫描")}}else this.setData({required:i.required||2}),this.updateHint(i.message,i.count)}},updateHint:function(t,e){if(this.data.hint!==t||this.data.progress!==e){var i=Date.now();this.lastHintTime&&i-this.lastHintTime<500&&0===e||(this.lastHintTime=i,this.setData({hint:t,progress:e}))}},toggleTorch:function(){if(!this._unloaded&&!this.photoLayoutPending&&"scanning"===this.data.phase){var t=!this.data.torchEnabled;this.recordPhotoEvent("torch.toggle",{nextEnabled:t}),this.setData({torchEnabled:t}),!d(wx,t)&&wx.showToast&&wx.showToast({title:"闪光灯设置暂未保存",icon:"none"})}},rescan:function(){this.receivedFrame=!1,this.start()},stop:function(){this.retryPhotoOnReady=!1,this.permissionTicket++,this.cleanup(),this.setData({phase:"idle",privacyVisible:!1,hint:"扫描已暂停"})},fail:function(t){this.retryPhotoOnReady=!1,this.cleanup(),this.setData({phase:"idle",hint:t})},cleanup:function(){if(this.pendingPhotoFrame=null,this.photoRetryFrame=null,this.workerRestartCount=0,clearTimeout(this.photoLayoutWatchdog),this.photoLayoutPending=!1,this.photoCameraBox=null,clearTimeout(this.systemReturnWatchdog),this.systemPickerWasHidden=!1,this.systemPhotoTicket=(this.systemPhotoTicket||0)+1,this.systemPhotoPending=!1,this.systemPhotoDecodePending=!1,this.systemPhotoRendered=!1,this.pendingSystemPhoto&&this.removePhotoFile(this.pendingSystemPhoto),this.pendingSystemPhoto=null,this.generation=++c,clearTimeout(this.noFrameTimer),clearTimeout(this.workerStartTimer),clearTimeout(this.workerWatchdog),clearTimeout(this.photoWatchdog),clearTimeout(this.photoRenderTimer),clearTimeout(this.detailTimer),this.listener){try{this.listener.stop()}catch(t){}this.listener=null}if(this.scanWorker){var t=this.scanWorker;this.scanWorker=null;try{t.terminate()}catch(t){}}this.gyroHandler&&wx.offGyroscopeChange&&wx.offGyroscopeChange(this.gyroHandler),this.gyroHandler&&wx.stopGyroscope&&wx.stopGyroscope({}),this.gyroHandler=null,this.workerReady=!1,this.busy=!1,this.photoBusy=!1,this.receivedFrame=!1,this.camera=null,this.photoCleanup&&this.photoCleanup(),this.photoCleanup=null,this.photoPath=null,this.photoProcessingDeadline=null,this._unloaded||this.setData({gyro:!1,photoReady:!1,workerReady:!1,photoPreview:"",cameraVisible:!1,cameraBoxStyle:"",photoNeedsRetake:!1})},onShow:function(){var t=this;if(this._hidden=!1,this.pendingSystemPhoto){var e=this.pendingSystemPhoto;this.pendingSystemPhoto=null,this.beginScan(e)}else if(this.systemPhotoPending&&this.systemPickerWasHidden){var i=this.systemPhotoTicket;this.systemReturnWatchdog=setTimeout(function(){t._hidden||t._unloaded||!t.systemPhotoPending||i!==t.systemPhotoTicket||t.fail("没有取得系统拍摄的照片，请重新拍照")},5e3)}this.systemPickerWasHidden=!1},onHide:function(){if(this._hidden=!0,this.retryPhotoOnReady=!1,this.systemPhotoPending||this.pendingSystemPhoto){this.systemPickerWasHidden=!0;return}["scanning","authorizing","capturing","photoProcessing"].includes(this.data.phase)&&(this.permissionTicket++,this.cleanup(),this.setData({phase:"idle",privacyVisible:!1,hint:"扫描已暂停，点击继续"}))},onUnload:function(){this._unloaded=!0,this.retryPhotoOnReady=!1,this.permissionTicket++,this.cleanup()}};module.exports={createLiveScanner:function(i){var o=e._(t._({},u),{data:e._(t._({},u.data),{captureMode:i.data.scanCaptureMode||"photo",torchEnabled:h(wx)}),properties:{structureKey:i.data.scanStructureKey},setData:function(e,o){e.phase&&void 0===e.cameraVisible&&(e.cameraVisible="scanning"===e.phase||"capturing"===e.phase),"scanning"===e.phase&&(e.cameraGeneration=this.generation),"scanning"===e.phase||"idle"===e.phase||"authorizing"===e.phase?(Object.assign(e,a({markerCount:0})),"scanning"===e.phase&&"photo"===(e.captureMode||this.data.captureMode)&&Object.assign(e,{guideTitle:"对准纸卡后点击拍照",guideTip:"四角和全部题区完整入镜，拍下后可以放下手机。"})):"done"===e.phase&&Object.assign(e,{guideStep:3,guideTitle:"识别完成",guideTip:"正在显示全部答案，红色题目请重点核对。"});var r=t._({},this.data,e);e.photoButtonText="capturing"===r.phase?"正在拍照":"photoProcessing"===r.phase?"照片识别中":r.photoReady?"拍照识别":"相机准备中";var s={},n=!0,h=!1,d=void 0;try{for(var c,u=Object.keys(e)[Symbol.iterator]();!(n=(c=u.next()).done);n=!0){var l=c.value;this.data[l]!==e[l]&&(s["scanner."+l]=e[l])}}catch(t){h=!0,d=t}finally{try{n||null==u.return||u.return()}finally{if(h)throw d}}Object.assign(this.data,e),this._unloaded||i._unloaded||(this.viewInitialized?Object.keys(s).length?i.setData(s,o):o&&(wx.nextTick?wx.nextTick(o):o()):(this.viewInitialized=!0,i.setData({scanner:t._({},this.data)},o)))},triggerEvent:function(t,e){this._unloaded||i._unloaded||"complete"!==t||i.onScanComplete({detail:e})}});return o.onLoad({examId:encodeURIComponent(i.data.examId),title:encodeURIComponent(i.data.title),questionCount:i.data.totalQuestions}),o}}; 
 			}); 
		define("utils/local-cache.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_sliced_to_array"),t=require("../@swc/runtime/_to_consumable_array"),r=function(e){return/^(exam_catalog_snapshot_v\d+|leaderboard_cache_|leaderboard_(base_)?v\d+_|leaderboard_snapshot_v\d+_|rank_snapshot_v\d+_|exam_data_)/.test(e)||"preload_leaderboard"===e},a=null;function n(e){try{return wx.getStorageSync(e)}catch(e){return null}}function o(e){try{return 2*JSON.stringify(e).length}catch(e){return 3145729}}function c(){if(!a){a=new Map;try{(wx.getStorageInfoSync().keys||[]).filter(r).forEach(function(e){var t=n(e);a.set(e,{bytes:o(t),at:Number(t&&(t.fetchedAt||t.timestamp))||0})})}catch(e){}}}function i(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"";c();var o=r;a.forEach(function(e,t){t!==n&&(o+=e.bytes)});var i=0;try{var _=wx.getStorageInfoSync();i=Math.max(0,(_.currentSize-.75*_.limitSize)*1024)}catch(e){}var l=t._(a.entries()).filter(function(t){return e._(t,1)[0]!==n}).sort(function(e,t){return e[1].at-t[1].at}),s=!0,u=!1,y=void 0;try{for(var d,f=l[Symbol.iterator]();!(s=(d=f.next()).done);s=!0){var h=e._(d.value,2),v=h[0],b=h[1];if(o<=3145728&&i<=0)break;try{wx.removeStorageSync(v),a.delete(v),o-=b.bytes,i-=b.bytes}catch(e){}}}catch(e){u=!0,y=e}finally{try{s||null==f.return||f.return()}finally{if(u)throw y}}}module.exports={read:n,write:function(e,t){var n=o(t);if(r(e)){if(n>3145728)return!1;i(n,e)}try{wx.setStorageSync(e,t)}catch(r){i(3145728,e);try{wx.setStorageSync(e,t)}catch(e){return!1}}return r(e)&&(c(),a.set(e,{bytes:n,at:Date.now()})),!0},trim:i,keepRecent:function(e,t,r){var a=arguments.length>3&&void 0!==arguments[3]?arguments[3]:3;for(delete e[t],e[t]=r;Object.keys(e).length>a;)delete e[Object.keys(e)[0]]},isDerived:r}; 
 			}); 
		define("utils/pdf-download.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_async_to_generator"),r=require("../@swc/runtime/_ts_generator"),t={fileID:"cloud://cloud1-8g137o5da8d5e269.636c-cloud1-8g137o5da8d5e269-1388442749/answer-cards/omr140-v2-a4-duplex-6de5f616a9b8.pdf",localFileName:"行测小助理专用答题卡_A4_140题_双面_11a10b2318b6.pdf",size:127617};module.exports={ANSWER_CARD_PDF:t,openAnswerCardPdf:function(){var n=arguments.length>0&&void 0!==arguments[0]?arguments[0]:function(){return!0};return e._(function(){var e,s,a,c,i,o;return r._(this,function(r){switch(r.label){case 0:e=wx.getFileSystemManager(),s=wx.env.USER_DATA_PATH+"/"+t.localFileName,a=function(e){return n()?new Promise(function(r,t){return wx.openDocument({filePath:e,fileType:"pdf",showMenu:!0,success:function(){return r(!0)},fail:t})}):Promise.resolve(!1)},c=!1;try{c=e.statSync(s).size===t.size}catch(e){}if(!c)return[3,4];r.label=1;case 1:return r.trys.push([1,3,,4]),[4,a(s)];case 2:return[2,r.sent()];case 3:r.sent();try{e.unlinkSync(s)}catch(e){}return[3,4];case 4:if(!n())return[2,!1];return[4,wx.cloud.downloadFile({fileID:t.fileID})];case 5:if(!(i=r.sent())||200!==i.statusCode||!i.tempFilePath)throw Error("答题卡下载失败");o=i.tempFilePath;try{e.saveFileSync(i.tempFilePath,s),o=s}catch(e){}return[2,a(o)]}})})()}}; 
 			}); 
		define("utils/photo-frame.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";module.exports={packPhotoFrame:function(r,e,t){if(!Number.isInteger(r)||!Number.isInteger(e)||r<=0||e<=0)throw Error("照片尺寸无效");var n=ArrayBuffer.isView(t)?new Uint8Array(t.buffer,t.byteOffset,t.byteLength):new Uint8Array(t);if(n.length!==r*e*4)throw Error("照片像素读取不完整");for(var f=new Uint8Array(r*e),i=0,a=0;i<f.length;i++,a+=4)f[i]=77*n[a]+150*n[a+1]+29*n[a+2]>>8;return{width:r,height:e,format:"gray8",data:f.buffer}}}; 
 			}); 
		define("utils/photo-quality.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_object_spread"),r=require("../@swc/runtime/_object_spread_props");module.exports={photoQuality:function(t,s){if(!t||!t.ok||!Array.isArray(t.items))return{needsRetake:!1};var i={filled:0,blank:0,review:0};t.items.slice(0,s).forEach(function(e){void 0!==i[e.status]&&i[e.status]++});var a=i.filled+i.review;return r._(e._({},i),{needsRetake:i.review>=8&&i.review/Math.max(1,a)>.3||i.review>Math.max(20,.25*s)})}}; 
 			}); 
		define("utils/real_data.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var B=[{_id:"26-huashengguokao1qi-1",setKey:"26-huashengguokao1qi-1",count:130,sections:[{title:"政治理论",count:20,answers:"DDADDCAADBDBADDAABCD"},{title:"常识判断",count:15,answers:"CDBDDCBBDBCCACC"},{title:"言语理解",count:30,answers:"CAABCADDACDCDCCBBCCACDBBDBCBAB"},{title:"数量关系",count:10,answers:"DCDACBAABB"},{title:"判断推理",count:35,answers:"BABBBDACBABDADDDACCDBADBAACBDBBCCBA"},{title:"资料分析",count:20,answers:"AACDCCCADABADCCADCAD"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-2",setKey:"26-huashengguokao1qi-2",count:130,sections:[{title:"政治理论",count:20,answers:"ACDBAAACCBBDDDACCCAD"},{title:"常识判断",count:15,answers:"BADDABBCCABDCCD"},{title:"言语理解",count:30,answers:"DCDAAAAACDDBDCDCCBBCACCBCAAABD"},{title:"数量关系",count:10,answers:"BDABCCDDCC"},{title:"判断推理",count:35,answers:"CCCCDABBBCCABBAAABDBDDCDDDCCBAADCDB"},{title:"资料分析",count:20,answers:"BBBBCBCDCDDCBABBACBB"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-3",setKey:"26-huashengguokao1qi-3",count:130,sections:[{title:"政治理论",count:20,answers:"DCDCBCCDABABCBCABDAC"},{title:"常识判断",count:15,answers:"BABDCCADCDCDABB"},{title:"言语理解",count:30,answers:"CADCAAABCDDAAACDBDBBDCCABDADBD"},{title:"数量关系",count:10,answers:"ADBABBDCDA"},{title:"判断推理",count:35,answers:"DDBBADADCDAACCBCABCDCAADADBABDBCBBC"},{title:"资料分析",count:20,answers:"ACBBDCBABCCBADDBCABA"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-4",setKey:"26-huashengguokao1qi-4",count:130,sections:[{title:"政治理论",count:20,answers:"BCDACBDBBCCACADDCCDC"},{title:"常识判断",count:15,answers:"CABABDDCBBCBBBC"},{title:"言语理解",count:30,answers:"CBBCCBDADABCBDBDAABDCDDBADAAAB"},{title:"数量关系",count:10,answers:"ADCDDDBCDB"},{title:"判断推理",count:35,answers:"ADBBCACBDDADBBDDBDBAADBAADDCBDBDAAC"},{title:"资料分析",count:20,answers:"BCACDCBCAABDBCBBDADD"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-5",setKey:"26-huashengguokao1qi-5",count:130,sections:[{title:"政治理论",count:20,answers:"DCABBCABDDBBCCADDCBB"},{title:"常识判断",count:15,answers:"AABDCCBBDBBDCBB"},{title:"言语理解",count:30,answers:"DACDACCCBDBBDCBCDBBBCBBACBBCDB"},{title:"数量关系",count:10,answers:"CBCABCDBDA"},{title:"判断推理",count:35,answers:"BABCADDCABABCDBABAACCDABCDBCABBCDAD"},{title:"资料分析",count:20,answers:"CBCDABCBCDADCBBACACD"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-6",setKey:"26-huashengguokao1qi-6",count:130,sections:[{title:"政治理论",count:20,answers:"DBAADCDDCDDCADBDDCCB"},{title:"常识判断",count:15,answers:"ACCABADAABDABBB"},{title:"言语理解",count:30,answers:"CBDCADCDBDBBDCACBCCBBCCBDACCCA"},{title:"数量关系",count:10,answers:"CBCCDDCABB"},{title:"判断推理",count:35,answers:"DBACADCADBBABACDBBABBCDDBDCBCDCBCBC"},{title:"资料分析",count:20,answers:"CDACDBACADBACBACBACD"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-7",setKey:"26-huashengguokao1qi-7",count:130,sections:[{title:"政治理论",count:20,answers:"DADDCBADDBADABBABCDA"},{title:"常识判断",count:15,answers:"BDCADCDBBBBCBAB"},{title:"言语理解",count:30,answers:"DBCDADACDCACCDBACDAADADBBCCCDB"},{title:"数量关系",count:10,answers:"ADABCACDCC"},{title:"判断推理",count:35,answers:"ADCDCDBDADDBDCACACDADCCBCBDBCADCCBC"},{title:"资料分析",count:20,answers:"CCBADDCADCACBDADBACC"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-8",setKey:"26-huashengguokao1qi-8",count:130,sections:[{title:"政治理论",count:20,answers:"BBCBBADDDADDBCACBABD"},{title:"常识判断",count:15,answers:"BCBCADCBCDACDAB"},{title:"言语理解",count:30,answers:"ABDACCCDACDACCBBACDBAADBDBCDDC"},{title:"数量关系",count:10,answers:"BCDCCDCABB"},{title:"判断推理",count:35,answers:"BCDCADAAABDDBADBAACBDDABCBADDBDCCCC"},{title:"资料分析",count:20,answers:"CCADDCBCBDABBDBCBADA"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-9",setKey:"26-huashengguokao1qi-9",count:130,sections:[{title:"政治理论",count:20,answers:"CADBABBCDCCCACBDDCAB"},{title:"常识判断",count:15,answers:"CBCDDACDCBDDBDA"},{title:"言语理解",count:30,answers:"DAACABBDACBAAABDCCABDBADCDBBAC"},{title:"数量关系",count:10,answers:"CCCDDCABAD"},{title:"判断推理",count:35,answers:"ADDDCDDCBADDDCDBDBADABACBBACBBBBABA"},{title:"资料分析",count:20,answers:"DABCDDCCADBCDACADCAD"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-10",setKey:"26-huashengguokao1qi-10",count:130,sections:[{title:"政治理论",count:20,answers:"ADCDAACADCCBBBBDCBDA"},{title:"常识判断",count:15,answers:"BBCDDBACCDADBCD"},{title:"言语理解",count:30,answers:"DCBACDAAACBDCADBBACCBBCCDBBDCD"},{title:"数量关系",count:10,answers:"BADCDBCACB"},{title:"判断推理",count:35,answers:"DBCAABBABABDBBDDABACDDCBDBCACDABCDD"},{title:"资料分析",count:20,answers:"CBCADBABBCAADBDBADCB"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-11",setKey:"26-huashengguokao1qi-11",count:130,sections:[{title:"政治理论",count:20,answers:"DACADADCACDDCBDADCDA"},{title:"常识判断",count:15,answers:"DBCDDDCCCCDCCCD"},{title:"言语理解",count:30,answers:"CCCDADDDABADDDCBDAADADAAADCCDA"},{title:"数量关系",count:10,answers:"BCDDADBCAB"},{title:"判断推理",count:35,answers:"ADDAABABDBCABBCCDBDDDABABADCBDBBDCC"},{title:"资料分析",count:20,answers:"CBADBCABABABACDBCBAB"}],showAvgToUser:!1},{_id:"26-huashengguokao1qi-12",setKey:"26-huashengguokao1qi-12",count:130,sections:[{title:"政治理论",count:20,answers:"CABDBACDBDCBCABCDBAC"},{title:"常识判断",count:15,answers:"CBABDBBCBCDDACB"},{title:"言语理解",count:30,answers:"CCDDDBBBCCBDBACAABABDCDDBABCBD"},{title:"数量关系",count:10,answers:"ACCBDACACB"},{title:"判断推理",count:35,answers:"BCACADBCBBDABADCBBADCDCABDACCACCBAC"},{title:"资料分析",count:20,answers:"BACDBCCAADCAADBBABDC"}],showAvgToUser:!1},{_id:"ab9277866926f628052b400745a2cdca",setKey:"26-huasheng1qi-1",count:130,sections:[{title:"政治理论",count:20,answers:"DDCCACADBBBDCCABAADB"},{title:"常识判断",count:15,answers:"DABDCCACBDCBBAC"},{title:"言语理解",count:30,answers:"DDCCBCDDCBDABADDDAADCDCDDDBACA"},{title:"数量关系",count:10,answers:"CACCDCBACC"},{title:"图形推理",count:10,answers:"DCABACDDBA"},{title:"定义判断",count:10,answers:"CBCBDACCDA"},{title:"类比推理",count:5,answers:"CDCBA"},{title:"逻辑判断",count:10,answers:"DACDABDBAC"},{title:"资料分析",count:20,answers:"BACCDACBCBDACDBADBAB"}],showAvgToUser:!1},{_id:"8656c0246926f6280526eb451f18d3a7",setKey:"26-huasheng1qi-2",count:130,sections:[{title:"政治理论",count:20,answers:"DDDDDBABDCCBDABDCCDC"},{title:"常识判断",count:15,answers:"BBDABBCDADABDDA"},{title:"言语理解",count:30,answers:"ABCDABDDCCAAAACBCBCDCCDCAAACAD"},{title:"数量关系",count:10,answers:"CBDADCCBCB"},{title:"图形推理",count:10,answers:"DABCBBAABD"},{title:"定义判断",count:10,answers:"DBADCDABBD"},{title:"类比推理",count:5,answers:"CBDBA"},{title:"逻辑判断",count:10,answers:"AADADBDDCC"},{title:"资料分析",count:20,answers:"ABDDBCBADADDACDCABBD"}],showAvgToUser:!1},{_id:"8f6c3a636926f628052e5bbc76805692",setKey:"26-huasheng1qi-3",count:130,sections:[{title:"政治理论",count:20,answers:"CBABBBCABACCDDABCDAC"},{title:"常识判断",count:15,answers:"AAADCADCDCABBAC"},{title:"言语理解",count:30,answers:"BBCBCABCDBDBACDDBACBBDBACDADAC"},{title:"数量关系",count:10,answers:"ADACDBBCDA"},{title:"图形推理",count:10,answers:"CBDCCADCDC"},{title:"定义判断",count:10,answers:"CBADDBDBDA"},{title:"类比推理",count:5,answers:"DBABB"},{title:"逻辑判断",count:10,answers:"ACADBACABC"},{title:"资料分析",count:20,answers:"CDACBACCCCBACCDBCDAB"}],showAvgToUser:!1},{_id:"ba046a626926f62805293def3b88e9a2",setKey:"26-huasheng1qi-4",count:130,sections:[{title:"政治理论",count:20,answers:"ADBDADBDDCDADAACCDDB"},{title:"常识判断",count:15,answers:"BBBDDDACABDBDBC"},{title:"言语理解",count:30,answers:"BADDBCDABAACBCBBDCCBABDDDACBBC"},{title:"数量关系",count:10,answers:"BCDDAACBBC"},{title:"图形推理",count:10,answers:"CADDADABCC"},{title:"定义判断",count:10,answers:"BBADABBDDA"},{title:"类比推理",count:5,answers:"ACBDA"},{title:"逻辑判断",count:10,answers:"ABBADCDCBB"},{title:"资料分析",count:20,answers:"BBDAADBCCACDBCCDBACB"}],showAvgToUser:!1},{_id:"a23524646926f628051f9963455ab59a",setKey:"26-huasheng1qi-5",count:130,sections:[{title:"政治理论",count:20,answers:"DCDCBCBCDBCAABCBCADD"},{title:"常识判断",count:15,answers:"AACBDDDCADCDADC"},{title:"言语理解",count:30,answers:"DCBADBBBDBDDDCCDCDCAABDCBDBBDC"},{title:"数量关系",count:10,answers:"DACDADACBD"},{title:"图形推理",count:10,answers:"CDBBCBDCCB"},{title:"定义判断",count:10,answers:"ADCBAABABD"},{title:"类比推理",count:5,answers:"DBCCA"},{title:"逻辑判断",count:10,answers:"ABADBBBDCA"},{title:"资料分析",count:20,answers:"ABCDCDBCACACDABCBBBD"}],showAvgToUser:!1},{_id:"da8988ea6926f628052b3f540946c293",setKey:"26-huasheng1qi-6",count:130,sections:[{title:"政治理论",count:20,answers:"BBAACDCBCBBCDCBBCCAD"},{title:"常识判断",count:15,answers:"BDCBCCDBDABDBBD"},{title:"言语理解",count:30,answers:"CBDCBCADBABACABCCACCABDBCCAADC"},{title:"数量关系",count:10,answers:"BCDDBCCBAC"},{title:"图形推理",count:10,answers:"DADACCDDBD"},{title:"定义判断",count:10,answers:"ACDCAADBDD"},{title:"类比推理",count:5,answers:"CBBAC"},{title:"逻辑判断",count:10,answers:"CDACBCDABB"},{title:"资料分析",count:20,answers:"DABCDCBDACBABCCDDABC"}],showAvgToUser:!1},{_id:"7f4b67136926f6280525e167209db02e",setKey:"26-huasheng1qi-7",count:130,sections:[{title:"政治理论",count:20,answers:"ACDDDBABACDBCAABACAD"},{title:"常识判断",count:15,answers:"DADCADBDBDCDDDD"},{title:"言语理解",count:30,answers:"ABDABDCADBDBBABDAADCDBBAAABABD"},{title:"数量关系",count:10,answers:"BDBBBCDCCB"},{title:"图形推理",count:10,answers:"CDCDCBABCA"},{title:"定义判断",count:10,answers:"ADCCACABDC"},{title:"类比推理",count:5,answers:"AACBA"},{title:"逻辑判断",count:10,answers:"DCBDCDABCC"},{title:"资料分析",count:20,answers:"BDBCBBABDCABBBCBDBAD"}],showAvgToUser:!1},{_id:"4289fa816926f6280526a86f6ed47f7d",setKey:"26-huasheng1qi-8",count:130,sections:[{title:"政治理论",count:20,answers:"BCCADCDCBBADCBBCBCAC"},{title:"常识判断",count:15,answers:"ADACABACBBBCDCD"},{title:"言语理解",count:30,answers:"DCABBBDCDBCBCCABADDCCAABDDCACD"},{title:"数量关系",count:10,answers:"BABADCBCAC"},{title:"图形推理",count:10,answers:"ABDCADABCC"},{title:"定义判断",count:10,answers:"DABDADCAAC"},{title:"类比推理",count:5,answers:"BBAAD"},{title:"逻辑判断",count:10,answers:"ACCCDCCACB"},{title:"资料分析",count:20,answers:"CDBABCBDADBADCBBADCC"}],showAvgToUser:!1},{_id:"743372846926f629052360ca413dd0cf",setKey:"26-huasheng1qi-9",count:130,sections:[{title:"政治理论",count:20,answers:"CCACBCAACCBDBDCCCCCB"},{title:"常识判断",count:15,answers:"BADDADABDDABDAC"},{title:"言语理解",count:30,answers:"CBAAADBCBBDCBADDDBDACCACCBDBAD"},{title:"数量关系",count:10,answers:"ACBADADAAB"},{title:"图形推理",count:10,answers:"BDCCCACDDC"},{title:"定义判断",count:10,answers:"BCCDDCDAAB"},{title:"类比推理",count:5,answers:"CDBBA"},{title:"逻辑判断",count:10,answers:"ADDDBBCBAB"},{title:"资料分析",count:20,answers:"ACDBACDABBCDCDCADBCC"}],showAvgToUser:!1},{_id:"dab5292a6926f6290525a6a417505755",setKey:"26-huasheng1qi-10",count:130,sections:[{title:"政治理论",count:20,answers:"CCCDDBBDBACBABBBBCDD"},{title:"常识判断",count:15,answers:"DADDCDCADCCABDB"},{title:"言语理解",count:30,answers:"ABDCDAACAACCABACBACADBDBABCAAD"},{title:"数量关系",count:10,answers:"AABABDDCDA"},{title:"图形推理",count:10,answers:"DAACABBCBA"},{title:"定义判断",count:10,answers:"DCBCCBDCBA"},{title:"类比推理",count:5,answers:"DBBAB"},{title:"逻辑判断",count:10,answers:"DABCADDCAD"},{title:"资料分析",count:20,answers:"BABBDBACDDDABACACBAB"}],showAvgToUser:!1},{_id:"ab9277866926f629052b40184de0b50c",setKey:"26-huasheng1qi-11",count:130,sections:[{title:"政治理论",count:20,answers:"ACCBBBACAAADBCBCCBCD"},{title:"常识判断",count:15,answers:"CDBCCDCCDBBDBAD"},{title:"言语理解",count:30,answers:"DDABDCADCBDDADCADACACBBDDADADB"},{title:"数量关系",count:10,answers:"CBCAACABCB"},{title:"图形推理",count:10,answers:"DCBACDDBCD"},{title:"定义判断",count:10,answers:"BDDBADBABC"},{title:"类比推理",count:5,answers:"CCBDC"},{title:"逻辑判断",count:10,answers:"BCCADBADAD"},{title:"资料分析",count:20,answers:"BADCDCABDBCABACACDDB"}],showAvgToUser:!1},{_id:"4289fa816926f6290526a8717379cd8d",setKey:"26-huasheng1qi-12",count:130,sections:[{title:"政治理论",count:20,answers:"DCBABDBDACAABADCACDC"},{title:"常识判断",count:15,answers:"ABBCBDBDDBAABAB"},{title:"言语理解",count:30,answers:"AABACBDCBBDABADBBAACCDDACADDAB"},{title:"数量关系",count:10,answers:"ADDABCDBBB"},{title:"图形推理",count:10,answers:"CAABBBDCCB"},{title:"定义判断",count:10,answers:"ADABDAACDB"},{title:"类比推理",count:5,answers:"CDCBD"},{title:"逻辑判断",count:10,answers:"DBBDBDACCA"},{title:"资料分析",count:20,answers:"DAABCADCABBBCCDABBCD"}],showAvgToUser:!1},{_id:"9e1b2c4d6926f629052e0001aa11bbcc",setKey:"26-huasheng2qi-1",count:130,sections:[{title:"政治理论",count:20,answers:"BCBCBBDCBADBDCDCCAAD"},{title:"常识判断",count:15,answers:"CCDDABBCACBCABD"},{title:"言语理解",count:30,answers:"CDCCDABACBCDCABDBDACBCBDACAABC"},{title:"数量关系",count:10,answers:"CADDBDAACC"},{title:"图形推理",count:10,answers:"BACCDADDAD"},{title:"定义判断",count:10,answers:"CABADDDABB"},{title:"类比推理",count:5,answers:"DCCBC"},{title:"逻辑判断",count:10,answers:"CDBAADCBDA"},{title:"资料分析",count:20,answers:"CBCDADCABACBADBBBACD"}],showAvgToUser:!1},{_id:"a0c3d5e76926f629052e0002bb22ccdd",setKey:"26-huasheng2qi-2",count:130,sections:[{title:"政治理论",count:20,answers:"BDAACBACCACDDDBCDCAA"},{title:"常识判断",count:15,answers:"BDABDCABCBDADAD"},{title:"言语理解",count:30,answers:"BADCACCCCDBAACCADCABABDCDABDAB"},{title:"数量关系",count:10,answers:"DBCBBCDCAC"},{title:"图形推理",count:10,answers:"ADCBBACDDA"},{title:"定义判断",count:10,answers:"CAABDDCADB"},{title:"类比推理",count:5,answers:"ADCCD"},{title:"逻辑判断",count:10,answers:"DABBCBCBCD"},{title:"资料分析",count:20,answers:"BCACDBABDCACDABABCBD"}],showAvgToUser:!1},{_id:"b1d4e6f86926f629052e0003cc33ddee",setKey:"26-huasheng2qi-3",count:130,sections:[{title:"政治理论",count:20,answers:"CBBDDABDCDADABCDDADB"},{title:"常识判断",count:15,answers:"DBCDBACCDBDBDCB"},{title:"言语理解",count:30,answers:"ADBDACBACACDCCCCBDCBCABDCBDCAA"},{title:"数量关系",count:10,answers:"CACACDADBB"},{title:"图形推理",count:10,answers:"ACADCDBABB"},{title:"定义判断",count:10,answers:"BCCDBDCDCA"},{title:"类比推理",count:5,answers:"ABBDC"},{title:"逻辑判断",count:10,answers:"BBDCDAABCA"},{title:"资料分析",count:20,answers:"DCAABABDDCADBDCCBACD"}],showAvgToUser:!1},{_id:"90522085f3b842849e53a84266041433",setKey:"26-huasheng2qi-4",count:130,sections:[{title:"政治理论",count:20,answers:"DCDABDCCABABBCDCCBAA"},{title:"常识判断",count:15,answers:"CCADDCDDABDABDC"},{title:"言语理解",count:30,answers:"ADCACABACDDDBDDABCCDADBADBDBCA"},{title:"数量关系",count:10,answers:"BCCDCCCBDC"},{title:"图形推理",count:10,answers:"CCBDABADBD"},{title:"定义判断",count:10,answers:"BADDADBCAC"},{title:"类比推理",count:5,answers:"DABDA"},{title:"逻辑判断",count:10,answers:"ADAABDAACC"},{title:"资料分析",count:20,answers:"BCBBCACDBDBBCDACCBBA"}],showAvgToUser:!1},{_id:"f9053a8cc31741aebf47bd4713770637",setKey:"26-huasheng2qi-5",count:130,sections:[{title:"政治理论",count:20,answers:"BBAABCADBBACDCAABCCD"},{title:"常识判断",count:15,answers:"BACDDBDACDBACCB"},{title:"言语理解",count:30,answers:"BAADABAABDCDCBCBDBDBCCDCABBDBB"},{title:"数量关系",count:10,answers:"ABBCDDBCBB"},{title:"图形推理",count:10,answers:"CACDACADBD"},{title:"定义判断",count:10,answers:"DDDCABDCDD"},{title:"类比推理",count:5,answers:"BABCB"},{title:"逻辑判断",count:10,answers:"BBCDACBBAD"},{title:"资料分析",count:20,answers:"CBBAACDCBBCBBACDCCCA"}],showAvgToUser:!1},{_id:"bf6476385b944488b0a71f0b2ea39358",setKey:"26-huasheng2qi-6",count:130,sections:[{title:"政治理论",count:20,answers:"CCDDCBDBACBBBCBABDAB"},{title:"常识判断",count:15,answers:"BDDDABAACABCBCC"},{title:"言语理解",count:30,answers:"BACADABDCBDCDBABDBCDACADCBABBD"},{title:"数量关系",count:10,answers:"CDABBCCBBD"},{title:"图形推理",count:10,answers:"CABCDBCABC"},{title:"定义判断",count:10,answers:"ABCBDACBAB"},{title:"类比推理",count:5,answers:"ABDBC"},{title:"逻辑判断",count:10,answers:"CABADCBADB"},{title:"资料分析",count:20,answers:"DBACABCCABCADDDBCCBA"}],showAvgToUser:!1},{_id:"73caf2c171104420b24907441d85ff7b",setKey:"26-huasheng2qi-7",count:130,sections:[{title:"政治理论",count:20,answers:"BBBBCDADACDBBBBDCDBC"},{title:"常识判断",count:15,answers:"CCBCDBBDADCDCAB"},{title:"言语理解",count:30,answers:"CBCCBDCAACCDBBBCDACDABCBDBBDBB"},{title:"数量关系",count:10,answers:"CDDDCACBCB"},{title:"图形推理",count:10,answers:"BBDDDACCAC"},{title:"定义判断",count:10,answers:"CACCADDDDA"},{title:"类比推理",count:5,answers:"CCDAD"},{title:"逻辑判断",count:10,answers:"DCBBBABCCD"},{title:"资料分析",count:20,answers:"DDACDBADAABADBDDCBCD"}],showAvgToUser:!1},{_id:"d7b535b38a7b4a4890e954eb6eddfd7f",setKey:"26-huasheng2qi-8",count:130,sections:[{title:"政治理论",count:20,answers:"BDABACDADCBADCDDACCC"},{title:"常识判断",count:15,answers:"AABDDBDABADAADD"},{title:"言语理解",count:30,answers:"BAAABCCBDDCAADACADCACCCADCDBCC"},{title:"数量关系",count:10,answers:"ACBBDCDDAB"},{title:"图形推理",count:10,answers:"CDDCAABCCC"},{title:"定义判断",count:10,answers:"BDADDACDCC"},{title:"类比推理",count:5,answers:"DDDCC"},{title:"逻辑判断",count:10,answers:"BABDDBACBC"},{title:"资料分析",count:20,answers:"CCDABABCBDBCBACACBCC"}],showAvgToUser:!1},{_id:"30577c56a0734676a2eae57078740b8a",setKey:"26-huasheng2qi-9",count:130,sections:[{title:"政治理论",count:20,answers:"CBCBDBCBABBBDDADCCBD"},{title:"常识判断",count:15,answers:"ADDCABCBDABDBDC"},{title:"言语理解",count:30,answers:"BAAACDBDDCAACABACDBBCCCADABCDD"},{title:"数量关系",count:10,answers:"DBCCCDADAA"},{title:"图形推理",count:10,answers:"DBACACDCAD"},{title:"定义判断",count:10,answers:"DBADABBDAA"},{title:"类比推理",count:5,answers:"BBDAB"},{title:"逻辑判断",count:10,answers:"CABBDABCBC"},{title:"资料分析",count:20,answers:"DBCABCAABCBDABDDDBCA"}],showAvgToUser:!1},{_id:"ae15a5a1401c4c37afbfc579fa44a308",setKey:"26-huasheng2qi-10",count:130,sections:[{title:"政治理论",count:20,answers:"CCCCDBCBCACDBBBDCCBB"},{title:"常识判断",count:15,answers:"AACCDDBADBCCCAD"},{title:"言语理解",count:30,answers:"DADAABCCDDCBAADCBCABBACACBAAAD"},{title:"数量关系",count:10,answers:"DDBABDABCA"},{title:"图形推理",count:10,answers:"DABBAADACA"},{title:"定义判断",count:10,answers:"CBADDCCDAD"},{title:"类比推理",count:5,answers:"CDCDC"},{title:"逻辑判断",count:10,answers:"CBACAADDBC"},{title:"资料分析",count:20,answers:"BCBADABCDDADDBDACBAD"}],showAvgToUser:!1},{_id:"26-huasheng2qi-11",setKey:"26-huasheng2qi-11",count:130,sections:[{title:"政治理论",count:20,answers:"BCDAACCDBBCABDBCADBA"},{title:"常识判断",count:15,answers:"DACACAABDBCACDD"},{title:"言语理解",count:30,answers:"CACBAABABAACBBCBBCACACCDDADBDB"},{title:"数量关系",count:10,answers:"ACBDDDBAAB"},{title:"图形推理",count:10,answers:"DBDABDBCCB"},{title:"定义判断",count:10,answers:"DDADABCBCA"},{title:"类比推理",count:5,answers:"CABAD"},{title:"逻辑判断",count:10,answers:"BCAAABDADB"},{title:"资料分析",count:20,answers:"ACDADABCADDBACBADBCC"}],showAvgToUser:!1},{_id:"26-huasheng2qi-12",setKey:"26-huasheng2qi-12",count:130,sections:[{title:"政治理论",count:20,answers:"CBDBABBBAADCBBCBABDA"},{title:"常识判断",count:15,answers:"BDDDCADBADDDADB"},{title:"言语理解",count:30,answers:"CBDADABCACBDCDCCBCADADBBDBDACA"},{title:"数量关系",count:10,answers:"CBCAACAACC"},{title:"图形推理",count:10,answers:"BACBDCDBCD"},{title:"定义判断",count:10,answers:"DABBCBACAB"},{title:"类比推理",count:5,answers:"CBACA"},{title:"逻辑判断",count:10,answers:"AABCACDACA"},{title:"资料分析",count:20,answers:"CCABBCADCDCCDBADACBC"}],showAvgToUser:!1},{_id:"553458d26f8046c98dad450b48353456",setKey:"26-shengkao1qi-1",count:120,sections:[{title:"政治理论",count:15,answers:"BDCBBDCDDADDCAC"},{title:"常识判断",count:10,answers:"BDADDCAABA"},{title:"言语理解",count:30,answers:"DADCDDDDBACDADACCAACDCCABADBAA"},{title:"数量关系",count:15,answers:"DBDACBAABCCBDAD"},{title:"判断推理",count:30,answers:"ADBBCBBCCCABDBCCBCABCBDBDBADBB"},{title:"资料分析",count:20,answers:"CCDACCBCADDCABBABCCD"}],showAvgToUser:!1},{_id:"8bcf4ff33cec4c8ab5ca1612298369dc",setKey:"26-shengkao1qi-2",count:120,sections:[{title:"政治理论",count:15,answers:"BCAABBCCACBCCCB"},{title:"常识判断",count:10,answers:"CABADDBCCD"},{title:"言语理解",count:30,answers:"CABBCBDAAADDBABACDDDDDCBCBAABA"},{title:"数量关系",count:15,answers:"ADCBCCBDBDCAADA"},{title:"判断推理",count:30,answers:"ADACDBDBDDADCDCDBADDBDDBBCADAC"},{title:"资料分析",count:20,answers:"DBCAAADBBBCBDADCBABD"}],showAvgToUser:!1},{_id:"4b39bf81552e4234839879317f7cf5da",setKey:"26-shengkao1qi-3",count:120,sections:[{title:"政治理论",count:15,answers:"DAADCDCDABBCDCD"},{title:"常识判断",count:10,answers:"CBAADDBBCB"},{title:"言语理解",count:30,answers:"BCCBCDBDACBDBDCACDCDBBADBCACAD"},{title:"数量关系",count:15,answers:"BDBCACCDDBCADCA"},{title:"判断推理",count:30,answers:"CAAACDADCBBDCBCDBBDADACCDBDADA"},{title:"资料分析",count:20,answers:"ABDDAADCCBCAAACCCBDD"}],showAvgToUser:!1},{_id:"76e6b4b7043e4f3d9a27a5dcc8711853",setKey:"26-shengkao1qi-4",count:120,sections:[{title:"政治理论",count:15,answers:"ADDBCBDCACCDDDB"},{title:"常识判断",count:10,answers:"ABDDCBBDCA"},{title:"言语理解",count:30,answers:"CABADACBBDDACDBDCBBDBDCAABACBC"},{title:"数量关系",count:15,answers:"CDDDABBAACADBCB"},{title:"判断推理",count:30,answers:"CDCADDCCBBBDCAAABADBBCDABBDCCC"},{title:"资料分析",count:20,answers:"CABDBBDAACCCAABCBCDA"}],showAvgToUser:!1},{_id:"e785f2ed80664ed997f7963143ed4fa2",setKey:"26-shengkao1qi-5",count:120,sections:[{title:"政治理论",count:15,answers:"CBADCDBACACBDAB"},{title:"常识判断",count:10,answers:"DCCBBABDAB"},{title:"言语理解",count:30,answers:"ABCCDDBAABCCDCDDCCBCADAAABDBCD"},{title:"数量关系",count:15,answers:"DCABADCBCBBACAD"},{title:"判断推理",count:30,answers:"BDCBDDBBACAADBCAABDBCCBCCDAADB"},{title:"资料分析",count:20,answers:"ACBDABAABDCBBDDABCDA"}],showAvgToUser:!1},{_id:"8356edd5527b479e85c3585be22c8007",setKey:"26-shengkao1qi-6",count:120,sections:[{title:"政治理论",count:15,answers:"ADCBADDBCDBDACA"},{title:"常识判断",count:10,answers:"ABCDCBDADD"},{title:"言语理解",count:30,answers:"ADCBBADCBBBDBACBADCDCAACACCDDB"},{title:"数量关系",count:15,answers:"BBDCCBCAAACBAAD"},{title:"判断推理",count:30,answers:"BCCBBBACABDCBBCBBDCBADCBDCABDB"},{title:"资料分析",count:20,answers:"BACDDDCBACCDABCABDAA"}],showAvgToUser:!1},{_id:"fbd812515c804da1af099f586d6de6b6",setKey:"26-shengkao1qi-7",count:120,sections:[{title:"政治理论",count:15,answers:"CDBCADACBBCDCCA"},{title:"常识判断",count:10,answers:"DCACDCCABA"},{title:"言语理解",count:30,answers:"ADBCDBCDBDDCDABCADBAAACAACCDCB"},{title:"数量关系",count:15,answers:"ADCCAABCBCDBCDD"},{title:"判断推理",count:30,answers:"ADBDBBCBBCCDCCADBBABDBAACCDCDB"},{title:"资料分析",count:20,answers:"BCBBDADBCDCDACDCBACD"}],showAvgToUser:!1},{_id:"auto_26-shengkao1qi-8",setKey:"26-shengkao1qi-8",count:120,sections:[{title:"政治理论",count:15,answers:"ACDBABDCDCBACAB"},{title:"常识判断",count:10,answers:"DDBACDAADB"},{title:"言语理解",count:30,answers:"BABACDCDBCCCDAABDBACDADCDBADDB"},{title:"数量关系",count:15,answers:"DACBCBCDCBABBDD"},{title:"判断推理",count:30,answers:"ABCBCBABCBCDDDDADDCDDBCBBDBDBC"},{title:"资料分析",count:20,answers:"BAABCCBBACDCDBAACDCC"}],showAvgToUser:!1},{_id:"8665f31113564e179de0154d66a28a78",setKey:"26-shengkao1qi-9",count:120,sections:[{title:"政治理论",count:15,answers:"CDAACADABBCBDAB"},{title:"常识判断",count:10,answers:"DABBDCDCBC"},{title:"言语理解",count:30,answers:"CBBCABBDABABDDBCADACDADBBBACBD"},{title:"数量关系",count:15,answers:"ADCBDDCDACABBBC"},{title:"判断推理",count:30,answers:"DBBBCBBBBCCBABCADABCDCBBCCCAAB"},{title:"资料分析",count:20,answers:"CBADCBACBCCDBABCDABB"}],showAvgToUser:!1},{_id:"auto_26-shengkao1qi-10",setKey:"26-shengkao1qi-10",count:120,sections:[{title:"政治理论",count:15,answers:"CDBCDCADBCBACDB"},{title:"常识判断",count:10,answers:"BCCBBBCDDA"},{title:"言语理解",count:30,answers:"BDBDCCACACDCABBDDDABAACDDACABA"},{title:"数量关系",count:15,answers:"CDAABBACDBCABDC"},{title:"判断推理",count:30,answers:"BCCADBCCBABBAADCBDBABBCCBDBBCA"},{title:"资料分析",count:20,answers:"BDACDCBACDBDBBCBCADB"}],showAvgToUser:!1},{_id:"auto_26-shengkao1qi-11",setKey:"26-shengkao1qi-11",count:120,sections:[{title:"政治理论",count:15,answers:"DCBDDABACAABDBD"},{title:"常识判断",count:10,answers:"BABCADACAB"},{title:"言语理解",count:30,answers:"ACBCDCADACACBADABCBBDDDAADDDAB"},{title:"数量关系",count:15,answers:"BDABDABCBCCDCCD"},{title:"判断推理",count:30,answers:"CCCACBDADABDDCDDBDACDCBCBABACD"},{title:"资料分析",count:20,answers:"AABBDCBDACCBCADCBBDC"}],showAvgToUser:!1},{_id:"auto_26-shengkao1qi-12",setKey:"26-shengkao1qi-12",count:120,sections:[{title:"政治理论",count:15,answers:"DACAACBADABADBD"},{title:"常识判断",count:10,answers:"BAABDCDABA"},{title:"言语理解",count:30,answers:"DBACDBBCBBADDDBCDCDBBDCDBDCCCB"},{title:"数量关系",count:15,answers:"DADCCBDACABDCAB"},{title:"判断推理",count:30,answers:"ACCBDADBABBBAADBBBAADBDDCDBADB"},{title:"资料分析",count:20,answers:"BABACCABDCBCACDABCBD"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-1",setKey:"26-shengkao2qi-1",count:120,sections:[{title:"政治理论",count:15,answers:"CDACBCBDACADBDB"},{title:"常识判断",count:10,answers:"CABDCBBDAB"},{title:"言语理解",count:30,answers:"BBCDDADCAACABCABDDBCDDADDCABAD"},{title:"数量关系",count:15,answers:"CBDACDCCABDBBBC"},{title:"判断推理",count:30,answers:"BDABBCACCBDACABDBBDACABDCDCDBD"},{title:"资料分析",count:20,answers:"ABACDCCDABCDABAACDAD"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-2",setKey:"26-shengkao2qi-2",count:120,sections:[{title:"政治理论",count:15,answers:"ADBDDBCBACBBABA"},{title:"常识判断",count:10,answers:"DCACADCAAD"},{title:"言语理解",count:30,answers:"CCDBBADAABBDCACBACCDACACDBDADC"},{title:"数量关系",count:15,answers:"DCBCBDCABABBDBB"},{title:"判断推理",count:30,answers:"ACABDDACBABCDADCCDDADCBADBCBCB"},{title:"资料分析",count:20,answers:"CCBDCDCACBBCADDBADCC"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-3",setKey:"26-shengkao2qi-3",count:120,sections:[{title:"政治理论",count:15,answers:"DABCADACBDACBDB"},{title:"常识判断",count:10,answers:"DDBCBBCDAD"},{title:"言语理解",count:30,answers:"ADBACDDCBABBABDDCBDCACCBDCBAAA"},{title:"数量关系",count:15,answers:"BDDCCABACBDACAB"},{title:"判断推理",count:30,answers:"DCDABCCCABDCDBABABDCCCDCDADCDB"},{title:"资料分析",count:20,answers:"ADCACBBDCCBCDACDCABD"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-4",setKey:"26-shengkao2qi-4",count:120,sections:[{title:"政治理论",count:15,answers:"DABCDADCBCBADCC"},{title:"常识判断",count:10,answers:"BDADADCADB"},{title:"言语理解",count:30,answers:"ACACBBBDADBABBAAABCABADDDBDCAC"},{title:"数量关系",count:15,answers:"CCBBDBCACCDBCAD"},{title:"判断推理",count:30,answers:"DBDDCADCBCDDCDDAADBCDBCABBBACC"},{title:"资料分析",count:20,answers:"DABBCCDBDCCBABDBDADB"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-5",setKey:"26-shengkao2qi-5",count:120,sections:[{title:"政治理论",count:15,answers:"DADAADBACADBDAC"},{title:"常识判断",count:10,answers:"BADCDADACA"},{title:"言语理解",count:30,answers:"CADCABBCDBDBCDCCCAADCACDBABACB"},{title:"数量关系",count:15,answers:"DCBABBDACADCCAD"},{title:"判断推理",count:30,answers:"ABBDCADDCBABCDADBADCDBABDCADCB"},{title:"资料分析",count:20,answers:"BCADDACBADBDADCADCDB"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-6",setKey:"26-shengkao2qi-6",count:120,sections:[{title:"政治理论",count:15,answers:"CDBDBACDACBDACC"},{title:"常识判断",count:10,answers:"ACCDADCBDC"},{title:"言语理解",count:30,answers:"AADBABDACBADDBCABBCBBBDCCBBDAB"},{title:"数量关系",count:15,answers:"CADCBDBCADADCAB"},{title:"判断推理",count:30,answers:"BCDCBCBAADDCACBCDCBDAACACADBDC"},{title:"资料分析",count:20,answers:"BBDBCABCADCBBDACAADC"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-7",setKey:"26-shengkao2qi-7",count:120,sections:[{title:"政治理论",count:15,answers:"ACDBCABCBACBABD"},{title:"常识判断",count:10,answers:"BADDADDAAA"},{title:"言语理解",count:30,answers:"CCAACCBBADBCCAABDBCDBDCABBDBBB"},{title:"数量关系",count:15,answers:"CDBBAADBCCBACCC"},{title:"判断推理",count:30,answers:"ABDBDAACCBAABBBDBBCDCCDCBDBDDB"},{title:"资料分析",count:20,answers:"DBDCDDCCABBACDABCDBD"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-8",setKey:"26-shengkao2qi-8",count:120,sections:[{title:"政治理论",count:15,answers:"BAADCBCDBABCDBD"},{title:"常识判断",count:10,answers:"DCABADDBAB"},{title:"言语理解",count:30,answers:"CCADCCCCCAACBBABCDDBBBBCABACAB"},{title:"数量关系",count:15,answers:"BCBDACABCADBDCD"},{title:"判断推理",count:30,answers:"CBACAADCABACADCDABDDDADACCCBDB"},{title:"资料分析",count:20,answers:"BCDADBDABCABCDBDADAC"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-9",setKey:"26-shengkao2qi-9",count:120,sections:[{title:"政治理论",count:15,answers:"CCBADADDDCDDDCA"},{title:"常识判断",count:10,answers:"BCDADDCCAB"},{title:"言语理解",count:30,answers:"AABADCBBBBCBCCDDDBAADDAADABCDD"},{title:"数量关系",count:15,answers:"ACBCBCDBDCABDDC"},{title:"判断推理",count:30,answers:"DDBCBBCBCADDACACDBCADDBBDCDAAA"},{title:"资料分析",count:20,answers:"CCBDABACDCDBCCDCBCBA"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-10",setKey:"26-shengkao2qi-10",count:120,sections:[{title:"政治理论",count:15,answers:"DDCBADDBCABACBA"},{title:"常识判断",count:10,answers:"AABBACDDBD"},{title:"言语理解",count:30,answers:"DDCACABADDABAABCDCBABDDBBBBCDA"},{title:"数量关系",count:15,answers:"BABDDBBCACCBACD"},{title:"判断推理",count:30,answers:"BBACACBBACDCABCCCCBDBDBBDBACAC"},{title:"资料分析",count:20,answers:"ADCDACADBCBACDBBDBAD"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-11",setKey:"26-shengkao2qi-11",count:120,sections:[{title:"政治理论",count:15,answers:"DCBADACDABBDCDD"},{title:"常识判断",count:10,answers:"BABAADCDBA"},{title:"言语理解",count:30,answers:"BDACADBDDCADDDABCACBDCDCACCADA"},{title:"数量关系",count:15,answers:"BCBDBDCABBDABBD"},{title:"判断推理",count:30,answers:"DCBAADADBACABDACDDACCCBCCABDCA"},{title:"资料分析",count:20,answers:"BCDDCBDABCBDCADBDDCC"}],showAvgToUser:!1},{_id:"auto_26-shengkao2qi-12",setKey:"26-shengkao2qi-12",count:120,sections:[{title:"政治理论",count:15,answers:"BDAACCBADABDCDB"},{title:"常识判断",count:10,answers:"DCBDADDBDD"},{title:"言语理解",count:30,answers:"CAADBDCCDDADDADDDBBDDBCACDADBD"},{title:"数量关系",count:15,answers:"ACBADBBCCACDDAA"},{title:"判断推理",count:30,answers:"DBCDABBAAACBDABCAABCCCCBACBCCA"},{title:"资料分析",count:20,answers:"CBABCBACADACBBDBCDCB"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_1",setKey:"26-chaoge-shengkao-1",count:125,sections:[{title:"政治理论",count:15,answers:"CDACCCDACCDABAC"},{title:"常识判断",count:15,answers:"ABCCDCCDCCABBDD"},{title:"言语理解",count:30,answers:"ACACCBCBACCBBADBDBDCCCDBBCCDCD"},{title:"数量关系",count:10,answers:"CBABDBBCAA"},{title:"判断推理",count:30,answers:"ADDBCBCCCAAABCBCDDBDDBAADCACCA"},{title:"资料分析",count:20,answers:"BCACDDBACCCBCACDBACC"},{title:"附加题",count:5,answers:"CDBAB"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_2",setKey:"26-chaoge-shengkao-2",count:125,sections:[{title:"政治理论",count:15,answers:"DCADDCADBCDDBBD"},{title:"常识判断",count:15,answers:"BACABCAACCDDCBC"},{title:"言语理解",count:30,answers:"ACDDACDAADADADCBCAADBCDADCBDAB"},{title:"数量关系",count:10,answers:"DADCCBAABC"},{title:"判断推理",count:30,answers:"BBCCBDBDDCADBACCABCCBDDADBABDB"},{title:"资料分析",count:20,answers:"DBACBADBCDDBBDCBCBBD"},{title:"附加题",count:5,answers:"CABCD"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_3",setKey:"26-chaoge-shengkao-3",count:125,sections:[{title:"政治理论",count:15,answers:"DCCCCDDABABACAD"},{title:"常识判断",count:15,answers:"BBBBDACADCDBBAA"},{title:"言语理解",count:30,answers:"BBDCDABDBDBDABCDBBBBDABADDCDBB"},{title:"数量关系",count:10,answers:"ADDACBCDCB"},{title:"判断推理",count:30,answers:"BBDBBDDBDDCADAAABCBABCDDDBBDCC"},{title:"资料分析",count:20,answers:"BDABCCCBABBCCDACBDCD"},{title:"附加题",count:5,answers:"DCBAB"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_4",setKey:"26-chaoge-shengkao-4",count:125,sections:[{title:"政治理论",count:15,answers:"BAACCBCDCCCDCDB"},{title:"常识判断",count:15,answers:"DCCCBADDBABBBDD"},{title:"言语理解",count:30,answers:"BDABDBBACDDAADBCBABBAADACDBBDB"},{title:"数量关系",count:10,answers:"CCBADABCDB"},{title:"判断推理",count:30,answers:"DCCDBACDBCDDBDBBBADBABCCDACBCA"},{title:"资料分析",count:20,answers:"BBDCCBABBDCBACCBCDDC"},{title:"附加题",count:5,answers:"BDABC"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_5",setKey:"26-chaoge-shengkao-5",count:125,sections:[{answers:"AABCCDAACDACCDB",count:15,title:"政治理论"},{count:15,title:"常识判断",answers:"BAABBDCCCBDCBCA"},{answers:"CCBBACDCCADBABCCDADABAADBBCBCB",count:30,title:"言语理解"},{answers:"CCDCABADBB",count:10,title:"数量关系"},{answers:"CABDDDCBBCACBDADDDCACABBBABACA",count:30,title:"判断推理"},{title:"资料分析",answers:"CABDCBBDACCADBADCBAB",count:20},{answers:"ABBAD",count:5,title:"附加题"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_6",setKey:"26-chaoge-shengkao-6",count:125,sections:[{title:"政治理论",count:15,answers:"DDACBDDDBDCDCCD"},{title:"常识判断",count:15,answers:"CCAABCACCCDBBDC"},{title:"言语理解",count:30,answers:"BDBBACAACBABDBAADCDBDBABBBCBCB"},{title:"数量关系",count:10,answers:"DABADDCBCA"},{title:"判断推理",count:30,answers:"ABCBDCBCAACDCDABDBBDAACCDCBDBB"},{title:"资料分析",count:20,answers:"CBBDDCDDDCBADDCBACBB"},{title:"附加题",count:5,answers:"CBDDC"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_7",setKey:"26-chaoge-shengkao-7",count:125,sections:[{title:"政治理论",count:15,answers:"DDABCDBCBDDAADA"},{title:"常识判断",count:15,answers:"CDABBCCCCAABBAB"},{title:"言语理解",count:30,answers:"DBBDBDADDCCCDADBDADDCBBADDAACD"},{title:"数量关系",count:10,answers:"ADBCDDCCAB"},{title:"判断推理",count:30,answers:"DABCBDABBDCBCCCADDADDCDBBACCBC"},{title:"资料分析",count:20,answers:"BCBBCADBBBCDACDDCBAC"},{title:"附加题",count:5,answers:"BDCAC"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_8",setKey:"26-chaoge-shengkao-8",count:125,sections:[{title:"政治理论",count:15,answers:"CCADCADACBBDBCA"},{title:"常识判断",count:15,answers:"DBCADBABABAADCB"},{title:"言语理解",count:30,answers:"DBAAACBBBDCCAADDACBDDAABAACDDC"},{title:"数量关系",count:10,answers:"BACCBBADDA"},{title:"判断推理",count:30,answers:"BACCDCCCACADAADAAACBAADCBACCBA"},{title:"资料分析",count:20,answers:"ACBBDCDABCABCDABAABD"},{title:"附加题",count:5,answers:"CCBDD"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_9",setKey:"26-chaoge-shengkao-9",count:125,sections:[{title:"政治理论",count:15,answers:"DAADCBADCCCBDDC"},{title:"常识判断",count:15,answers:"DCCBBDCADDCDABD"},{title:"言语理解",count:30,answers:"BAAAACAADABABCAABDDCCCBDBCBDAC"},{title:"数量关系",count:10,answers:"CCDCBBACDA"},{title:"判断推理",count:30,answers:"ABABDBADDDBBBCACDCBBBDBBBAACCB"},{title:"资料分析",count:20,answers:"CCBDABACADCDCACBCBCC"},{title:"附加题",count:5,answers:"DBCBA"}],showAvgToUser:!1},{_id:"26_chaoge_shengkao_10",setKey:"26-chaoge-shengkao-10",count:125,sections:[{title:"政治理论",count:15,answers:"DCADDCDCCCCCBBB"},{title:"常识判断",count:15,answers:"DBBDABCDDCDADDB"},{title:"言语理解",count:30,answers:"ACDACBCBCCCCCBBDDABCBDDACDCBCA"},{title:"数量关系",count:10,answers:"ACBBCDDADB"},{title:"判断推理",count:30,answers:"CCAACCACCBAACDBBDBBCCCCDDDADCD"},{title:"资料分析",count:20,answers:"CABBDCBCDACBDADCBCDB"},{title:"附加题",count:5,answers:"BDCAC"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_1",setKey:"26-chaoge-taojuan-1",count:135,sections:[{title:"政治理论",count:20,answers:"CBADCDCDDCDCAACCBADA"},{title:"常识判断",count:15,answers:"BADCCBDCBACDDDA"},{title:"言语理解",count:30,answers:"CBBCDBABBDBBAADDBAADBCBCDCDDBC"},{title:"数量关系",count:10,answers:"AAABCCDBDC"},{title:"判断推理",count:35,answers:"DBCADDCCADACAABDAACADDDBADCBBACADAD"},{title:"资料分析",count:20,answers:"DBACCCADDDCDABDBBCBB"},{title:"附加题(不计分)",count:5,answers:"BCDDD"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_2",setKey:"26-chaoge-taojuan-2",count:135,sections:[{title:"政治理论",count:20,answers:"BDDBDCCCBDCCCBCCACBC"},{title:"常识判断",count:15,answers:"BCBBDBBDCDBCDCB"},{title:"言语理解",count:30,answers:"ADBBAAABCADDAADBBCBCAABDCDACCC"},{title:"数量关系",count:10,answers:"CBBCAABABD"},{title:"判断推理",count:35,answers:"AAADCBCBBDABCDABBAABBBBCBADCCDACDBA"},{title:"资料分析",count:20,answers:"BDACDBCACDDBDCCDBDAC"},{title:"附加题(不计分)",count:5,answers:"AAACD"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_3",setKey:"26-chaoge-taojuan-3",count:135,sections:[{title:"政治理论",count:20,answers:"ACDACCDACBDCADACBACC"},{title:"常识判断",count:15,answers:"CBCCCDABADDCDBC"},{title:"言语理解",count:30,answers:"BBCDBBBADDABDBDAAADBBABCCADAAC"},{title:"数量关系",count:10,answers:"DADBDCDAAC"},{title:"判断推理",count:35,answers:"DACCBBADABCDCBDAAABDCBBDCDCCABCDDDC"},{title:"资料分析",count:20,answers:"DACBCBCACBDBBDACABBD"},{title:"附加题(不计分)",count:5,answers:"DAABC"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_4",setKey:"26-chaoge-taojuan-4",count:135,sections:[{title:"政治理论",count:20,answers:"BBDDCCADDCDCDABDCDAC"},{title:"常识判断",count:15,answers:"CCCDCDBCBAAAAAC"},{title:"言语理解",count:30,answers:"CDCBDBCABCABCBCACBAABABAADCCBA"},{title:"数量关系",count:10,answers:"DDDDDBCBCC"},{title:"判断推理",count:35,answers:"DCACCBDCBBACDCBADDDDDDDBCCBABCBCDBC"},{title:"资料分析",count:20,answers:"BCCBADBCADBADBCBADCD"},{title:"附加题(不计分)",count:5,answers:"BAABB"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_5",setKey:"26-chaoge-taojuan-5",count:135,sections:[{title:"政治理论",count:20,answers:"CACCDBDDDBBCCBDBCBDB"},{title:"常识判断",count:15,answers:"BACBBACCDBBDDBD"},{title:"言语理解",count:30,answers:"BADBACBBACBBCBCCCCABBAABBCBDBA"},{title:"数量关系",count:10,answers:"ACDABBBAAA"},{title:"判断推理",count:35,answers:"BBCBDDBAADDADBDDCCCBAAADACACDDCBADD"},{title:"资料分析",count:20,answers:"ACBBACBBACDCBADCABDC"},{title:"附加题(不计分)",count:5,answers:"BDADB"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_6",setKey:"26-chaoge-taojuan-6",count:135,sections:[{title:"政治理论",count:20,answers:"BCADBDCBCBCDADDCDDDA"},{title:"常识判断",count:15,answers:"CBDDDDCCBBDDBCD"},{title:"言语理解",count:30,answers:"BABADADACAACDBBCBADCCDACBADDCA"},{title:"数量关系",count:10,answers:"DBBBCBBCBD"},{title:"判断推理",count:35,answers:"CCDDCCACABABBBBDBBACBDDBABBDABDADAC"},{title:"资料分析",count:20,answers:"CBDACCDBCBCCAABACDBD"},{title:"附加题(不计分)",count:5,answers:"BBBDB"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_7",setKey:"26-chaoge-taojuan-7",count:120,sections:[{title:"政治理论",count:10,answers:"ACDBDBBDCA"},{title:"常识判断",count:10,answers:"CDDDDDADAA"},{title:"言语理解",count:30,answers:"ABBBCBDBBDAADCAADDCBABCAADACBA"},{title:"数量关系",count:10,answers:"DBBDBCCCBD"},{title:"判断推理",count:40,answers:"CDCBABDCDBDDABDCCCDBCCBCDCDCCBCCBACBCDCB"},{title:"资料分析",count:20,answers:"ADCCBBABDCCBABDCBADC"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_8",setKey:"26-chaoge-taojuan-8",count:120,sections:[{title:"政治理论",count:10,answers:"CCDCBCDDBD"},{title:"常识判断",count:10,answers:"BBACDABABB"},{title:"言语理解",count:30,answers:"AABCDDBCCBABCCCDCCCACDBBABAACD"},{title:"数量关系",count:10,answers:"CADBBCDADC"},{title:"判断推理",count:40,answers:"ABDABBBABCBDCCABBCCBCCDADBCCCBCCBBACDABA"},{title:"资料分析",count:20,answers:"CABACCCABDACBBDBCADB"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_9",setKey:"26-chaoge-taojuan-9",count:120,sections:[{title:"政治理论",count:10,answers:"CBDBDBDBAB"},{title:"常识判断",count:10,answers:"CBDCCABBAC"},{title:"言语理解",count:30,answers:"ABDACDADBBBBADACADADCBABCCDABA"},{title:"数量关系",count:10,answers:"BABAACCDCC"},{title:"判断推理",count:40,answers:"BBDACCDBBBBBCDADABCDDCAADADCDBBDACDDCBAD"},{title:"资料分析",count:20,answers:"CBACDADBCCBBACDBACDB"}],showAvgToUser:!1},{_id:"26_chaoge_taojuan_10",setKey:"26-chaoge-taojuan-10",count:120,sections:[{title:"政治理论",count:10,answers:"DCDAACBCCB"},{title:"常识判断",count:10,answers:"ABADDBBCCB"},{title:"言语理解",count:30,answers:"DDCBADDDCAABACCDBDDDCCAABCCBAC"},{title:"数量关系",count:10,answers:"DCDAACCCDB"},{title:"判断推理",count:40,answers:"DDCCDDCACDABBACACBBAABCBDDBDADACCCCDADBD"},{title:"资料分析",count:20,answers:"ADBABCBBDAACCBAADCCB"}],showAvgToUser:!1},{_id:"92287c4480fa8367f318a52c50e72619",setKey:"26-huasheng-shiye-A-1",count:100,sections:[{title:"常识判断",count:20,answers:"DADADACDCCCCABDADDBC"},{title:"言语理解",count:25,answers:"BBBCCBACBCCADCDDBABACBBDB"},{title:"数量关系",count:5,answers:"ACDCC"},{title:"判断推理",count:35,answers:"ABDDBCDDCBCCBDBDDDABCABCABCDCCDADDB"},{title:"资料分析",count:15,answers:"CBCDABCBCDCBDBC"}],showAvgToUser:!1},{_id:"c9e43816466e79be67ef3f63a8b0c7b4",setKey:"26-huasheng-shiye-A-2",count:100,sections:[{title:"常识判断",count:20,answers:"ABBBAACABDBDDBDCAACD"},{title:"言语理解",count:25,answers:"ABBCDBABDCBABCABCBCABDBAD"},{title:"数量关系",count:5,answers:"CABCD"},{title:"判断推理",count:35,answers:"ADDADACBCADDBBBBCBCBCABDADCADBDBAAD"},{title:"资料分析",count:15,answers:"CABADBBCADBCBBA"}],showAvgToUser:!1},{_id:"afeb7aa262b8503fca89e627d92bbb58",setKey:"26-huasheng-shiye-A-3",count:100,sections:[{title:"常识判断",count:20,answers:"ACABABBABBCABADBAACD"},{title:"言语理解",count:25,answers:"DAADCABDDBCBBCAADDCBABABC"},{title:"数量关系",count:5,answers:"CDBAB"},{title:"判断推理",count:35,answers:"ACADCDDADABDCBDABBDCBCBDCBBDCBABBAA"},{title:"资料分析",count:15,answers:"DCADBDABCDBDBAC"}],showAvgToUser:!1},{_id:"808089baf7a845b0cecc5667c94c7cdb",setKey:"26-huasheng-shiye-A-4",count:100,sections:[{title:"常识判断",count:20,answers:"BBCBBDBABDCCDCCDABAC"},{title:"言语理解",count:25,answers:"DCBBDCBCABDABBAACACADCDBD"},{title:"数量关系",count:5,answers:"AADCB"},{title:"判断推理",count:35,answers:"ABBCDCDBABBACADADBACBDDADCCBAAAAACD"},{title:"资料分析",count:15,answers:"BCCADDCBBACABDC"}],showAvgToUser:!1},{_id:"6d4091bb847ac2f3010c10bf3fc3c25a",setKey:"26-huasheng-shiye-A-5",count:100,sections:[{title:"常识判断",count:20,answers:"DBBDCBCDBCADADBDCBAC"},{title:"言语理解",count:25,answers:"ADCCBACBDABCABCDCAACBBACA"},{title:"数量关系",count:5,answers:"BDCBA"},{title:"判断推理",count:35,answers:"ADCBBDDCBDDACDBBADCDADBCACDBADACCBD"},{title:"资料分析",count:15,answers:"BCDCDBCCBABCCBD"}],showAvgToUser:!1},{_id:"a2eee16102694ba83cde6bcd87c24e74",setKey:"26-huasheng-shiye-A-6",count:100,sections:[{title:"常识判断",count:20,answers:"BACCABBACADBADCCABAC"},{title:"言语理解",count:25,answers:"CADCBACADBDBCDBCCBBDADBCC"},{title:"数量关系",count:5,answers:"DABAD"},{title:"判断推理",count:35,answers:"CDDCBADACCBBBCDBABADDADDACAACCABACD"},{title:"资料分析",count:15,answers:"ABACACDDADCABDC"}],showAvgToUser:!1},{_id:"132a74e7976bbb2e3471d132547523fc",setKey:"26-huasheng-shiye-A-7",count:100,sections:[{title:"常识判断",count:20,answers:"ADACACDBCCACDBBAADCB"},{title:"言语理解",count:25,answers:"DBBDACBCCADBACACBDCBCBDDB"},{title:"数量关系",count:5,answers:"CADDB"},{title:"判断推理",count:35,answers:"CBABDDBCACBDCCAABBCADCDCADABBDBDDBC"},{title:"资料分析",count:15,answers:"DCAABABDDCADBCC"}],showAvgToUser:!1},{_id:"f628f4d68082632ea549bd5893091cb1",setKey:"26-huasheng-shiye-A-8",count:100,sections:[{title:"常识判断",count:20,answers:"DCBAADACBABCADDABABD"},{title:"言语理解",count:25,answers:"DCACDAAABDCACDBBCABBDDADC"},{title:"数量关系",count:5,answers:"DBBCA"},{title:"判断推理",count:35,answers:"DBCADBDDBABACCACBADABDCCBCBCDCAAAAD"},{title:"资料分析",count:15,answers:"BDAACACDBDBADCD"}],showAvgToUser:!1},{_id:"fa5c0cf2d40da3a4ce01768479685aaa",setKey:"26-huasheng-shiye-A-9",count:100,sections:[{title:"常识判断",count:20,answers:"DACBDCAACDADCBBDACBD"},{title:"言语理解",count:25,answers:"CCDACCADBDBBADACDCABABCDA"},{title:"数量关系",count:5,answers:"BCADA"},{title:"判断推理",count:35,answers:"AABDBBDCDCDBBAAABACBDCBDADBADBCACDB"},{title:"资料分析",count:15,answers:"CBCADBCDABCBADD"}],showAvgToUser:!1},{_id:"447fa067e5e40f6d166ba71469f273c5",setKey:"26-huasheng-shiye-A-10",count:100,sections:[{title:"常识判断",count:20,answers:"ACDACDDBBCABCBAADBAA"},{title:"言语理解",count:25,answers:"DBCAAABAADBDDCBAADACBCBDC"},{title:"数量关系",count:5,answers:"CBBCC"},{title:"判断推理",count:35,answers:"BBADDBAACCCADBDDCACCADBBCDCADABDACD"},{title:"资料分析",count:15,answers:"ADBCDCBCDACDBCB"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-1",setKey:"27-chaoge-taojuan-1",count:135,sections:[{title:"政治理论",count:20,answers:"DDDDCDBCCCCDBBACBBDA"},{title:"常识判断",count:15,answers:"ADBCDCBDBDBADCB"},{title:"言语理解",count:30,answers:"CDBBDDBBDCDABACABBCCBBBABBCDDB"},{title:"数量关系",count:10,answers:"ACBBACABAA"},{title:"判断推理",count:35,answers:"ABDACDDBACDDDABADBBADCBAAACCBCBCBCD"},{title:"资料分析",count:20,answers:"DBCACDBACADACBCDABDA"},{id:"sec_extra",scored:!1,title:"附加题（不计分）",count:5,answers:"DCABD"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-2",setKey:"27-chaoge-taojuan-2",count:135,sections:[{title:"政治理论",count:20,answers:"DCBCCDCDDBCDCADABDDB"},{title:"常识判断",count:15,answers:"DBBDCABBDDCDADD"},{title:"言语理解",count:30,answers:"DABCCDACDDDACDCDAABCCCDADBCCCD"},{title:"数量关系",count:10,answers:"ACDDBADBAA"},{title:"判断推理",count:35,answers:"DDAACCDADCDBAACDBACBCBAABBBADBCDDBB"},{title:"资料分析",count:20,answers:"BACBDBCDCADBCABACDDB"},{id:"sec_extra",scored:!1,title:"附加题（不计分）",count:5,answers:"ACDCB"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-3",setKey:"27-chaoge-taojuan-3",count:135,sections:[{title:"政治理论",count:20,answers:"DADBBDDBBDCBDBCBBCBC"},{title:"常识判断",count:15,answers:"BDACABADBACDBCB"},{title:"言语理解",count:30,answers:"CDCADDDCAAADDABCDAACBDAAAADCDD"},{title:"数量关系",count:10,answers:"BDCABACBCB"},{title:"判断推理",count:35,answers:"ADCDBDABBADDDDABCBAACAABBBCBCBDACBB"},{title:"资料分析",count:20,answers:"DADBCCACBDBBACDCCDBA"},{id:"sec_extra",scored:!1,title:"附加题（不计分）",count:5,answers:"CBDCA"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-4",setKey:"27-chaoge-taojuan-4",count:135,sections:[{title:"政治理论",count:20,answers:"CAACCCACADDABDCBCADD"},{title:"常识判断",count:15,answers:"CCDAABCDCCADDAB"},{title:"言语理解",count:30,answers:"ABADAADABBCCDBDBBDABCDAADBDDCD"},{title:"数量关系",count:10,answers:"DADDBBCCBA"},{title:"判断推理",count:35,answers:"ACDCCDACBCBBADACCCCAACDDBCCACACDACB"},{title:"资料分析",count:20,answers:"BCCDABCBBCCBABDBDABD"},{id:"sec_extra",scored:!1,title:"附加题（不计分）",count:5,answers:"BDBCB"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-5",setKey:"27-chaoge-taojuan-5",count:135,sections:[{title:"政治理论",count:20,answers:"BBCDCBCDCDDBDBBBBACD"},{title:"常识判断",count:15,answers:"BACCCBBBCBDAABC"},{title:"言语理解",count:30,answers:"BBABBADBCBBBDDCBBDDABACDBCCDAC"},{title:"数量关系",count:10,answers:"CBCDDBCABC"},{title:"判断推理",count:35,answers:"CBCADBDDCDBDCBADBDCABBCCDCCAACDACBD"},{title:"资料分析",count:20,answers:"BADBDCBADBBCBACBDADC"},{id:"sec_extra",scored:!1,title:"附加题（不计分）",count:5,answers:"CACDC"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-6",setKey:"27-chaoge-taojuan-6",count:135,sections:[{title:"政治理论",count:20,answers:"BADDDBCADDAACADCADBD"},{title:"常识判断",count:15,answers:"BDDBCBDDBCCBCBB"},{title:"言语理解",count:30,answers:"ADBCBDCCCABCDBDBADAABBDACBADAD"},{title:"数量关系",count:10,answers:"ACDCDCCDDC"},{title:"判断推理",count:35,answers:"ACDBCDDCDBCDBBAADCBCDDDADCBDAACCACA"},{title:"资料分析",count:20,answers:"ADCABBCCBADBACBADABD"},{id:"sec_extra",scored:!1,title:"附加题（不计分）",count:5,answers:"ACABD"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-7",setKey:"27-chaoge-taojuan-7",count:120,sections:[{title:"政治理论",count:10,answers:"AADCBDBDDD"},{title:"常识判断",count:10,answers:"ADDCCDCDCA"},{title:"言语理解",count:30,answers:"CDDBACACBACBDADBBABBADCCCADBAC"},{title:"数量关系",count:10,answers:"CBCDADDCDB"},{title:"判断推理",count:40,answers:"ACADBDCADAADDDCCDBACABCDBACAADCDDDBCCDBB"},{title:"资料分析",count:20,answers:"BDCABBADAAADCBDCBCAD"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-8",setKey:"27-chaoge-taojuan-8",count:120,sections:[{title:"政治理论",count:10,answers:"DCDACCAADA"},{title:"常识判断",count:10,answers:"BBBBAACBDB"},{title:"言语理解",count:30,answers:"ABBCAACDADCACDACCADDDBBCCCCABB"},{title:"数量关系",count:10,answers:"DAADCDBABB"},{title:"判断推理",count:40,answers:"BBBBBDBAAAABACCBABAADBBBABDACAADDDAAABCD"},{title:"资料分析",count:20,answers:"ACCBBBDACDBABCCABBDB"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-9",setKey:"27-chaoge-taojuan-9",count:120,sections:[{title:"政治理论",count:10,answers:"DBDCCCCABC"},{title:"常识判断",count:10,answers:"ACDCAADCDB"},{title:"言语理解",count:30,answers:"BADCACBBADDBBACABCDCCDDDDBBCBD"},{title:"数量关系",count:10,answers:"BABDCBACBA"},{title:"判断推理",count:40,answers:"AABCBBCBBACDADCBBDACBBDADCCBDCCABACADDCB"},{title:"资料分析",count:20,answers:"BDACDACBADADCCDDCABB"}],showAvgToUser:!1},{_id:"27-chaoge-taojuan-10",setKey:"27-chaoge-taojuan-10",count:120,sections:[{title:"政治理论",count:10,answers:"DBCDCBCADA"},{title:"常识判断",count:10,answers:"CDDCCCCDBB"},{title:"言语理解",count:30,answers:"BABACBDCDDDBCDBCBBADDCBABBDBCA"},{title:"数量关系",count:10,answers:"CDCBCBABCB"},{title:"判断推理",count:40,answers:"DCABDDDBACBADCCACCBBDBBDCADBCCABACCACDDC"},{title:"资料分析",count:20,answers:"DDABCCAABCADCBBACCBA"}],showAvgToUser:!1}];B.forEach(function(B){B.sections&&(B.answers=[],B.sections.forEach(function(C){if(C.answers){var D="string"==typeof C.answers?C.answers.split(""):C.answers;B.answers=B.answers.concat(D)}}))}),module.exports=B; 
 			}); 
		define("utils/result-session.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var e=require("./local-cache.js"),t=null;function r(e,t){return!!e&&!!t&&e.examId===t.examId&&(e._id&&t._id?e._id===t._id:void 0!==e.timestamp&&e.timestamp===t.timestamp)}function u(){return t||e.read("current_exam_result")}function i(r){t=r,e.write("current_exam_result",r)}module.exports={get:u,set:i,update:function(e){r(u(),e)&&i(e)},remove:function(e){if(u()&&u()._id===e){t=null;try{wx.removeStorageSync("current_exam_result")}catch(e){}}},same:r}; 
 			}); 
		define("utils/runtime-diagnostics.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_object_spread"),t=require("./local-cache.js");module.exports={record:function(i){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};try{var s=t.read("runtime_diagnostics_v1")||[],o={};["code","message","width","height","scale","mode","level","currentSize","limitSize"].forEach(function(e){void 0!==r[e]&&(o[e]="string"==typeof r[e]?r[e].slice(0,160):r[e])}),s.push(e._({at:Date.now(),event:i},o)),t.write("runtime_diagnostics_v1",s.slice(-20))}catch(e){}},copy:function(){var e={},i={};try{var r=wx.getSystemInfoSync();e={model:r.model,system:r.system,SDKVersion:r.SDKVersion,version:r.version}}catch(e){}try{var s=wx.getStorageInfoSync();i={currentSize:s.currentSize,limitSize:s.limitSize}}catch(e){}wx.setClipboardData({data:JSON.stringify({version:"result-stability-10.21-1",device:e,storage:i,events:t.read("runtime_diagnostics_v1")||[]},null,2)})}}; 
 			}); 
		define("utils/scan-guidance.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";module.exports={scanGuidance:function(e){var r=4===Number(void 0===e.markerCount?4*!!e.corners:e.markerCount);return{markerPresence:e.markerPresence||[r,r,r,r],guideStep:r&&"DUPLICATE"!==e.code?2:1,guideTitle:e.ok?"正在核对答案":r&&"DUPLICATE"!==e.code?"已找到答题卡":"对准四个定位块",guideTip:e.ok?"请稍停一下，核对完成后自动显示所有答案。":({ALIGNMENT:"把纸张放平，稍停一下，正在确认定位块的位置。",DUPLICATE:"画面中只保留一张答题卡，再对准四个绿色框。",SIZE:"请稍微靠近纸卡，四个定位块和完整题区都要留在画面内。",LIGHT:"移开阴影，避免反光，让整张答题卡亮度均匀。",GRID:"请放平纸卡，让全部题区和右侧黑条清楚入镜。",CLARITY:"请稍微靠近，停一下让相机对焦，避免晃动或反光。"})[e.code]||"让纸卡四个黑色定位块分别靠近四个绿框，题区完整入镜。"}}}; 
 			}); 
		define("utils/scan-session.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_class_call_check"),s=require("../@swc/runtime/_create_class"),t=require("../@swc/runtime/_object_spread"),r=require("../@swc/runtime/_object_spread_props"),n=/*#__PURE__*/function(){function n(){e._(this,n),this.reset()}return s._(n,[{key:"reset",value:function(){this.frames=[],this.lastCorners=null,this.failures=0,this.lastGoodAt=0}},{key:"push",value:function(e){var s=this,n=arguments.length>1&&void 0!==arguments[1]&&arguments[1],i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:"video",a=Date.now();if(n)return this.reset(),{locked:!1,count:0,message:"稳住手机，正在等清晰画面"};if(!e.ok)return this.failures++,(!["MARKERS","GRID","CLARITY","SIZE","LIGHT","ALIGNMENT"].includes(e.code)||this.failures>2||a-this.lastGoodAt>8e3)&&this.reset(),{locked:!1,count:this.frames.length,message:e.message};var u=e.corners||[],o="detail"===i||"photo"===i?1:2;if(("detail"===i||"photo"===i||a-this.lastGoodAt>8e3||this.lastCorners&&u.some(function(e,t){return Math.hypot(e[0]-s.lastCorners[t][0],e[1]-s.lastCorners[t][1])>.07}))&&(this.frames=[]),this.failures=0,this.lastGoodAt=a,this.lastCorners=u,this.frames.push(e),this.frames.length>o&&this.frames.shift(),this.frames.length<o)return{locked:!1,count:this.frames.length,required:o,message:"正在核验答案，很快显示结果"};var l=e.items.map(function(e,n){var i=s.frames.map(function(e){return e.items[n]});return i.some(function(e){return"review"===e.status})?r._(t._({},e),{answer:null,status:"review",reason:i.find(function(e){return"review"===e.status}).reason||"填涂需要核对"}):i.every(function(s){return s.status===e.status&&s.answer===e.answer})?e:r._(t._({},e),{answer:null,status:"review",reason:"连续画面结果有变化，请核对"})}),h={filled:0,blank:0,review:0};return l.forEach(function(e){return h[e.status]++}),{locked:!0,count:this.frames.length,required:o,result:r._(t._({},e),{items:l,summary:h,answers:l.map(function(e){return e.answer}),reviewQuestions:l.filter(function(e){return"review"===e.status}).map(function(e){return e.number}),stableFrames:this.frames.length,frameSource:i}),message:"已读出答案"}}}]),n}();module.exports={ScanSession:n}; 
 			}); 
		define("utils/scan-submit-ad.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var r=require("../@swc/runtime/_sliced_to_array"),e=require("../@swc/runtime/_to_consumable_array");module.exports={createScanSubmitAd:function(o){var n,t=null,a=null,c=0,d=!1,i=!1,u=!1,s=0,l=!1,f="",v=function(r){u||o._unloaded||o.setData(r)},h=function(){clearTimeout(n),n=null},_=function(r){var e=r&&(void 0!==r.errCode?r.errCode:void 0!==r.errorCode?r.errorCode:r.code);return(void 0!==e?"微信错误码 "+e+"：":"")+String(r&&(r.errMsg||r.message)||("string"==typeof r?r:"微信未返回详细原因")).slice(0,220)},g=function(){var e=t,o=a;if(t=null,a=null,c++,e){for(var n=0,d=[["offLoad",o&&o.load],["offError",o&&o.error],["offClose",o&&o.close]];n<d.length;n++){var i=r._(d[n],2),u=i[0],s=i[1];try{e[u]&&s&&e[u](s)}catch(r){}}try{e.destroy&&e.destroy()}catch(r){}}},A=function(r){d&&!u&&(d=!1,s++,h(),g(),v({scanAdStage:"error",scanAdError:r}))},y=function(){},p=function(r){f=_(r),d&&"watching"===o.data.scanAdStage&&A("广告播放失败，答案已保留。"+f)},w=function(r){d&&l&&!u&&!o._unloaded&&(d=!1,s++,h(),g(),r&&!0===r.isEnded?(i=!0,v({scanAdStage:"complete",scanAdError:""})):v({scanAdStage:"idle",scanAdError:"广告尚未完成，需完成后才能交卷，答案已保留"}))};return{canSubmit:function(){return i&&!u},isBusy:function(){return d},watch:function(){if(!u&&!o._unloaded&&!d&&!i){d=!0,l=!1,f="";var r=++s;v({scanAdStage:"loading",scanAdError:""});try{if(!t){if(!wx.createRewardedVideoAd)throw Error("请升级微信后重试广告");t=wx.createRewardedVideoAd({adUnitId:"adunit-e2988a740408ec48",multiton:!0});var g=++c;a={load:function(){for(var r=arguments.length,o=Array(r),n=0;n<r;n++)o[n]=arguments[n];g===c&&y.apply(void 0,e._(o))},error:function(){for(var r=arguments.length,o=Array(r),n=0;n<r;n++)o[n]=arguments[n];g===c&&p.apply(void 0,e._(o))},close:function(){for(var r=arguments.length,o=Array(r),n=0;n<r;n++)o[n]=arguments[n];g===c&&w.apply(void 0,e._(o))}},t.onLoad(a.load),t.onError(a.error),t.onClose(a.close)}var S=t,m=function(){return!u&&d&&r===s&&t===S&&!o._unloaded},E=function(){if(m())return l=!0,S.show()};n=setTimeout(function(){m()&&A("广告加载超时，答案已保留。"+(f||"请稍后重试"))},2e4),Promise.resolve().then(E).catch(function(r){if(f||(f=_(r)),m())return S.load().then(E)}).then(function(){m()&&(h(),v({scanAdStage:"watching"}))}).catch(function(r){m()&&((r&&(void 0!==r.errCode||void 0!==r.errorCode||void 0!==r.code)||!f.startsWith("微信错误码 "))&&(f=_(r)),A("广告暂时无法展示，答案已保留。"+f))})}catch(r){A("广告暂时不可用，答案已保留。"+_(r))}}},reset:function(){s++,d=!1,i=!1,h(),g(),v({scanAdStage:"idle",scanAdError:""})},destroy:function(){u=!0,s++,d=!1,i=!1,h(),g()}}}}; 
 			}); 
		define("utils/static-snapshot.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_async_to_generator"),t=require("../@swc/runtime/_ts_generator"),r=require("./local-cache.js");module.exports={createSnapshotReader:function(n){var u=new Map,a=new Map,c=new Map,l=function(l){var i=l.key,s=l.file,o=l.validate,f=l.forceRefresh,d=void 0!==f&&f,h=l.preferNewer,v=void 0!==h&&h,_=l.isEmpty,w=void 0===_?function(){return!1}:_;return e._(function(){var l,f,h,_,y,p,g,m,b,A;return t._(this,function(S){switch(S.label){case 0:f=Math.floor((l=Date.now())/216e5),h=a.get(i);try{(_=wx.getStorageSync(i))&&o(_.value)&&(!h||_.fetchedAt>h.fetchedAt)&&(h=_)}catch(e){}if(y=function(){return h&&o(h.value)?h.value:null},p=h&&w(h.value)?12e4:216e5,!d&&h&&o(h.value)&&h.bucket===f&&l>=h.fetchedAt&&l-h.fetchedAt<p)return[2,h.value];if(g=i+"_"+f,u.has(g))return[2,u.get(g)];if(m=c.get(i),!d&&void 0!==m&&l>=m&&l-m<3e4)return[2,y()];b=function(e){return new Promise(function(t){try{wx.request({url:n+s+"?snapshot=v4-"+f+(e?"&retry=1":"")+(d?"&t="+l:""),timeout:6e3,success:function(e){return t(200===e.statusCode&&o(e.data)?e.data:null)},fail:function(){return t(null)}})}catch(e){t(null)}})},A=e._(function(){var e,n,u,s;return t._(this,function(t){switch(t.label){case 0:return[4,b(0)];case 1:if(null!==(e=t.sent())||null!==y())return[3,3];return[4,b(1)];case 2:e=t.sent(),t.label=3;case 3:if(null===e)return c.set(i,Date.now()),[2,y()];c.delete(i),n=a.get(i)||h;try{(u=wx.getStorageSync(i))&&o(u.value)&&(!n||u.fetchedAt>n.fetchedAt)&&(n=u)}catch(e){}if(v&&n&&o(n.value)&&Number(n.value.updateTime)>Number(e.updateTime)&&(e=n.value),s={value:e,fetchedAt:l,bucket:f},!n||!Number.isFinite(n.bucket)||n.bucket<=f){for(a.set(i,s);a.size>12;)a.delete(a.keys().next().value);r.write(i,s)}return[2,e]}})})(),u.set(g,A),S.label=1;case 1:return S.trys.push([1,,3,4]),[4,A];case 2:return[2,S.sent()];case 3:return u.delete(g),[7];case 4:return[2]}})})()};return l.cacheTimestamp=function(e){var t=a.get(e);try{t=t||wx.getStorageSync(e)}catch(e){}return t&&Number.isFinite(t.fetchedAt)?216e5*Math.floor(t.fetchedAt/216e5):0},l.clearMemory=function(){a.clear(),c.clear()},l.invalidate=function(e){a.delete(e),c.delete(e);try{wx.removeStorageSync(e)}catch(e){}},l}}; 
 			}); 
		define("utils/stats-snapshot.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var r=require("../@swc/runtime/_sliced_to_array");module.exports={rankFromSnapshot:function(e,t){var n=Number(e&&e.totalCount),u=Number(t);if(!Number.isFinite(n)||n<1||!Number.isFinite(u)||!e.scoreRankMap)return null;var i=Object.entries(e.scoreRankMap).map(function(e){var t=r._(e,2),n=t[0],u=t[1];return[Number(n),Number(u)]}).filter(function(e){var t=r._(e,2),u=t[0],i=t[1];return Number.isFinite(u)&&Number.isInteger(i)&&i>=1&&i<=n}).sort(function(r,e){return e[0]-r[0]});if(!i.length)return null;var a=i.find(function(e){return r._(e,1)[0]<=u}),o=a?a[1]:n+1,s=Math.max(n,o),m=s<=1?u>0?"100":"0":1===o?"100":Math.max(0,(s-o)*100/(s-1)).toFixed(1);return{rank:o,percent:m,totalSubmissions:s}}}; 
 			}); 
		define("utils/timer-records.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../@swc/runtime/_to_consumable_array"),t="prep_timer_records_v1",r="prep_timer_legacy_imported_v1",n="模考训练分析报告";function i(e){if(!Array.isArray(e)||!e.length||e.length>100)return null;for(var t=[],r=0;r<e.length;r++){var n=e[r];if(!n||"string"!=typeof n.name||!n.name.trim())return null;var i=Number(n.duration),a=Number(n.elapsed||0);if(!Number.isFinite(i)||i<0||i>60||!Number.isSafeInteger(a)||a<0)return null;t.push({id:void 0===n.id?r+1:n.id,name:n.name.trim(),duration:i,elapsed:a})}return t}function a(e){if(!e||"string"!=typeof e.id||!/^[a-zA-Z0-9_-]{1,100}$/.test(e.id))return null;var t=i(e.modules);if(!t||!["draft","finished"].includes(e.state)||!Number.isFinite(e.startedAt)||!Number.isFinite(e.savedAt))return null;var r=Number(e.currentModuleIndex);return{id:e.id,state:e.state,modules:t,currentModuleIndex:Number.isInteger(r)&&r>=0&&r<t.length?r:0,timeDisplayMode:[0,1,2].includes(e.timeDisplayMode)?e.timeDisplayMode:2,startedAt:e.startedAt,savedAt:e.savedAt,finishedAt:"finished"===e.state&&Number.isFinite(e.finishedAt)?e.finishedAt:null,reportTitle:"string"==typeof e.reportTitle&&e.reportTitle.trim()?e.reportTitle.trim().slice(0,100):n,legacy:!0===e.legacy}}function o(e){var r=e.getStorageSync(t);if(!r)return[];if(1!==r.version||!Array.isArray(r.records))throw Error("Invalid timer backup");return r.records.map(a).filter(Boolean).sort(function(e,t){return t.savedAt-e.savedAt})}function u(e){try{var r=o(e),n=r.slice(0,3);if(r.length>3)try{e.setStorageSync(t,{version:1,records:n})}catch(e){}return n}catch(e){return[]}}function s(e,t){return u(e).find(function(e){return e.id===t})||null}function d(r,n){try{var i=a(n);if(!i)return!1;var u=o(r),s=u.find(function(e){return e.id===i.id});if(s&&"finished"===s.state&&"draft"===i.state)return!1;var d=[i].concat(e._(u.filter(function(e){return e.id!==i.id}))).sort(function(e,t){return t.savedAt-e.savedAt}).slice(0,3);return r.setStorageSync(t,{version:1,records:d}),!0}catch(e){return!1}}module.exports={MAX_RECORDS:3,DEFAULT_TITLE:n,cleanModules:i,createRecordId:function(){return"timer_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10)},readTimerRecords:u,getTimerRecord:s,saveTimerRecord:d,importLegacyReport:function(e){try{if(e.getStorageSync(r))return;var t=i(e.getStorageSync("reportData"));if(t&&!s(e,"timer_legacy_report")){var n=Date.now();if(!d(e,{id:"timer_legacy_report",state:"finished",modules:t,startedAt:n,savedAt:n,finishedAt:null,currentModuleIndex:0,timeDisplayMode:2,legacy:!0}))return}e.setStorageSync(r,!0)}catch(e){}},formatElapsed:function(e){var t=Math.max(0,Math.floor(Number(e)||0));return Math.floor(t/60).toString().padStart(2,"0")+":"+(t%60).toString().padStart(2,"0")},formatRecordDate:function(e){var t=new Date(e),r=function(e){return String(e).padStart(2,"0")};return t.getFullYear()+"/"+r(t.getMonth()+1)+"/"+r(t.getDate())+" "+r(t.getHours())+":"+r(t.getMinutes())}}; 
 			}); 
		define("utils/torch-preference.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var e="scan_torch_enabled";module.exports={readTorchPreference:function(r){try{var t=r.getStorageSync(e);return"boolean"==typeof t&&t}catch(e){return!1}},saveTorchPreference:function(r,t){try{return r.setStorageSync(e,!!t),!0}catch(e){return!1}}}; 
 			}); 
		define("app.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var r=require("./utils/local-cache.js"),e=require("./utils/runtime-diagnostics.js");App({onLaunch:function(){var n=this;r.trim(),wx.onMemoryWarning&&wx.onMemoryWarning(function(r){e.record("memory.warning",r||{});try{getCurrentPages().forEach(function(r){r.onMemoryPressure&&r.onMemoryPressure()}),require("./utils/cloud.js").releaseSnapshotMemory(),n.globalData.leaderboardCache={}}catch(r){}}),wx.cloud?wx.cloud.init({env:"cloud1-8g137o5da8d5e269",traceUser:!0}):console.error("请使用 2.2.3 或以上的基础库以使用云能力")},onUnhandledRejection:function(r){var n=r&&r.reason;e.record("app.rejection",{message:String(n&&(n.errMsg||n.message)||n||"")}),console.warn("Unhandled Rejection:",r)},onError:function(r){e.record("app.error",{message:String(r)})},globalData:{userInfo:null}}); 
 			}); 	require("app.js");
 		__wxRoute = 'components/hero-ranking/hero-ranking';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'components/hero-ranking/hero-ranking.js';	define("components/hero-ranking/hero-ranking.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),t=require("../../@swc/runtime/_object_spread"),r=require("../../@swc/runtime/_object_spread_props"),a=require("../../@swc/runtime/_ts_generator"),s=require("../../utils/cloud.js"),n=(s.uploadFile,s.saveUserProfile),i=(s.getUserProfile,s.uploadUserAvatar),o=s.fetchExamData,l=s.fetchLeaderboardSnapshot,u=require("../../utils/data.js"),c=require("../../utils/event-bus.js"),d=require("../../utils/hero-detail.js").buildHeroDetail,h=require("../../utils/history-detail.js"),p=require("../../utils/answer-compat.js").hasAnswerPayload;Component({properties:{loading:{type:Boolean,value:!1},loadError:{type:Boolean,value:!1},list:{type:Array,value:[]},currentUserProfile:{type:Object,value:null},title:{type:String,value:"\uD83C\uDFC6 英雄榜"},limit:{type:Number,value:0},showProfileHint:{type:Boolean,value:!1},theme:{type:String,value:"card"},examId:{type:String,value:""}},data:{showFullLeaderboard:!1,showLoginModal:!1,tempAvatar:"",tempNickname:"",showDetailModal:!1,selectedUser:null,currentDetailIndex:-1,detailLoading:!1,detailError:"",detailNotice:""},observers:{currentUserProfile:function(e){e&&this.setData({tempAvatar:e.avatar||e.avatarUrl||"",tempNickname:e.nickName||e.nickname||""})}},lifetimes:{detached:function(){this._detailToken=(this._detailToken||0)+1}},methods:{onRetryLoad:function(){this.triggerEvent("retry")},toggleLeaderboard:function(){this.setData({showFullLeaderboard:!this.data.showFullLeaderboard})},onEditProfileTap:function(){var e=this.properties.currentUserProfile||{};this.setData({showLoginModal:!0,tempAvatar:e.avatar||e.avatarUrl||"",tempNickname:e.nickName||e.nickname||""})},onCloseModal:function(){this.setData({showLoginModal:!1})},noop:function(){},onChooseAvatar:function(e){console.log("HeroRanking: onChooseAvatar triggered",e);var t=e.detail.avatarUrl;t?(console.log("HeroRanking: Got avatarUrl",t),this.setData({tempAvatar:t})):console.error("HeroRanking: No avatarUrl returned from chooseAvatar")},onNicknameInput:function(e){this.setData({tempNickname:e.detail.value})},onSaveUserInfo:function(){return e._(function(){var e,s,o,l,u,d,h,p,f;return a._(this,function(a){switch(a.label){case 0:if(console.log("HeroRanking: onSaveUserInfo called"),!this.data.tempAvatar||!this.data.tempNickname)return wx.showToast({title:"请完善头像和昵称",icon:"none"}),[2];wx.showLoading({title:"保存中..."}),a.label=1;case 1:a.trys.push([1,9,,10]),s="",a.label=2;case 2:return a.trys.push([2,4,,5]),[4,(0,require("../../utils/cloud.js").getOpenId)()];case 3:return s=a.sent(),[3,5];case 4:return console.error("Fetch OpenID failed",a.sent()),[3,5];case 5:if(!(!(o=s||(null==(e=this.properties.currentUserProfile)?void 0:e.userId))||o.startsWith("user_"))||o||(o="user_".concat(Date.now(),"_").concat(Math.floor(1e3*Math.random()))),u=(l=this.data.tempAvatar).startsWith("wxfile")||l.startsWith("http")&&!l.startsWith("https"),d=l,!u)return[3,7];return[4,i(l)];case 6:console.log("HeroRanking: Upload success, fileID:",d=a.sent()),a.label=7;case 7:return p=(h={userId:o,avatar:d,nickname:this.data.tempNickname}).avatar,u&&(p=l),[4,n(h)];case 8:return a.sent(),(f=getApp()).globalData&&(f.globalData.userInfo||(f.globalData.userInfo={}),f.globalData.userInfo.profile=r._(t._({},h),{avatar:p}),f.globalData.userInfo.openid=o),wx.setStorageSync("userInfo",h),this.triggerEvent("profileupdate",r._(t._({},h),{avatar:p})),c.emit("user_profile_updated",r._(t._({},h),{avatar:p,userId:o})),wx.hideLoading(),this.setData({showLoginModal:!1}),wx.showToast({title:"保存成功",icon:"success"}),[3,10];case 9:return console.error(a.sent()),wx.hideLoading(),wx.showToast({title:"保存失败",icon:"none"}),[3,10];case 10:return[2]}})}).call(this)},onShowDetailTap:function(e){var t=Number(e.currentTarget.dataset.index);if(Number.isInteger(t)&&!(t<0)&&!(t>=this.properties.list.length))return this.setData({showDetailModal:!0}),this.showDetailForIndex(t)},onCloseDetailModal:function(){this._detailToken=(this._detailToken||0)+1,this.setData({showDetailModal:!1,detailLoading:!1})},onNextUser:function(){return this.showDetailForIndex(this.data.currentDetailIndex+1)},onPrevUser:function(){return this.showDetailForIndex(this.data.currentDetailIndex-1)},retryDetailLoad:function(){return this.showDetailForIndex(this.data.currentDetailIndex,!0)},showDetailForIndex:function(s){var n=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return e._(function(){var i,c,f,_,m,w,g,v,D,x,b,I,k,y,A;return a._(this,function(N){switch(N.label){case 0:if(i=this,c=this.properties.list,!Number.isInteger(s)||s<0||s>=c.length)return[2];f=this._detailToken=(this._detailToken||0)+1,m=(_=t._({},c[s])).examId||this.properties.examId,w=_._id?m+":"+_._id:null,g=function(){return f===i._detailToken},this.setData({currentDetailIndex:s,selectedUser:r._(t._({},_),{sectionStats:[]}),detailLoading:!0,detailError:"",detailNotice:""}),N.label=1;case 1:if(N.trys.push([1,8,,9]),this._detailRecordCache=this._detailRecordCache||new Map,v=w&&this._detailRecordCache.get(w)||_,!(_._localOnly&&!p(v)))return[3,3];return[4,h.load(v,function(t){return e._(function(){return a._(this,function(e){switch(e.label){case 0:return[4,wx.cloud.database().collection("exam_history").doc(t).get()];case 1:return[2,e.sent().data]}})})()})];case 2:if(v=N.sent(),!g())return[2];N.label=3;case 3:if((x=d(v,D={}))&&!(x.unknownCount>0)||(D={examStructure:u.getExamStructure&&u.getExamStructure(m),answers:u.getCorrectAnswers&&u.getCorrectAnswers(m)},x=d(v,D)),!((!x||n)&&!_._localOnly))return[3,5];return[4,l(m,!0)];case 4:if(b=N.sent(),!g())return[2];if(!(I=Array.isArray(b)&&_._id&&b.find(function(e){return e._id===_._id}))||Number(I.score)!==Number(_.score))throw Error("本条成绩的详情暂时无法读取，请刷新英雄榜后重试");(x=d(v=r._(t._({},_),{userAnswers:I.userAnswers,correctAnswers:I.correctAnswers,userWrongAnswers:I.userWrongAnswers,unansweredQuestions:I.unansweredQuestions,examStructure:I.examStructure,answerDetailsAvailable:I.answerDetailsAvailable}),D))&&w&&this._detailRecordCache.set(w,v),N.label=5;case 5:if(!(!x||x.unknownCount>0))return[3,7];return this._detailExamPromises=this._detailExamPromises||new Map,this._detailExamPromises.has(m)||(k=o(m).then(function(e){return e||i._detailExamPromises.delete(m),e}).catch(function(e){throw i._detailExamPromises.delete(m),e}),this._detailExamPromises.set(m,k)),[4,this._detailExamPromises.get(m)];case 6:if(y=N.sent(),!g())return[2];y&&(x=d(v,D=y)),N.label=7;case 7:if(!x)throw Error("本条成绩未提供完整作答详情，请刷新英雄榜后重试");if(!g())return[2];return w&&this._detailRecordCache.set(w,v),this.setData({selectedUser:r._(t._({},_),{sectionStats:x.sectionStats,correctCount:x.unknownCount?_.correctCount:x.correctCount,totalQuestions:x.totalQuestions}),detailLoading:!1,detailNotice:x.unknownCount?"部分题目缺少标准答案，暂不判定对错":""}),[3,9];case 8:return A=N.sent(),g()&&this.setData({detailLoading:!1,detailError:A.message||"详情加载失败，请重试"}),[3,9];case 9:return[2]}})}).call(this)}}}); 
 			}); 	require("components/hero-ranking/hero-ranking.js");
 		__wxRoute = 'pages/index/index';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/index/index.js';	define("pages/index/index.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../@swc/runtime/_async_to_generator"),e=require("../../@swc/runtime/_define_property"),a=require("../../@swc/runtime/_object_spread"),i=require("../../@swc/runtime/_object_spread_props"),o=require("../../@swc/runtime/_sliced_to_array"),n=require("../../@swc/runtime/_to_consumable_array"),r=require("../../@swc/runtime/_ts_generator"),s=require("../../utils/local-cache.js"),c=require("../../utils/data.js"),l=(c.categories,c.getPeriods),h=c.getCategories,u=c.setCloudCatalog,d=require("../../utils/cloud.js"),f=d.getExamHistory,g=d.getAvailableExams,m=d.getTempFileURL,v=require("../../utils/pdf-download.js").openAnswerCardPdf,w=require("../../utils/feature-flags.js").QUESTION_BANK_ENABLED,p="cloud://cloud1-8g137o5da8d5e269.636c-cloud1-8g137o5da8d5e269-1388442749/motivation_audio/maozedong.mp3";Page({data:{questionBankEnabled:w,supportDeveloperEnabled:0,answerCardDownloading:!1,categories:[],categoryLimit:3,hasMoreCategories:!1,activeCategory:null,periods:[],floatingPoints:[],expandedExams:{},cloudExams:[],activeLibrary:"peanut",showMotivationOverlay:!1,motivationTitle:"致决战省考的你：",motivationParagraphs:["经济下行，考公难度一路飙升，选择走上这条路的你，注定要熬过无数常人难以忍受的煎熬与孤独。但你依然敢于直面这地狱级的考验，在逆境中咬牙坚持走到了出征的今天，这份不服输的拼劲、不认输的坚守，本就是这世间最震撼人心的力量。你真的很棒，值得所有的掌声与喝彩。","借此出征之际，“行测小助理” 想为你送上最诚挚的祝福：愿你执笔为剑，落笔生花，考场之上所向披靡，此战终能得偿所愿。我们更盼着，当你考完这一场，人生从此彻底告别行测与申论的束缚。","这世间的精彩，从来不止于书本里的知识点、试卷上的选择题。那些被刷题与备考占满的日夜，本该用来去欣赏名山大川的风景，去品尝街头巷尾的人间美食，去陪伴久违的家人与挚友，去拥抱那个本该鲜活热烈的自己。","我很荣幸，只伴你人生这一程风雨；而你，即将奔赴的，是更广阔的星辰大海。","各位，愿你一战上岸，开启新的篇章，然后笑着对我说出“再也不见”。愿你此去前程似锦，终能把有限的生命，投入到无限的为人民服务中去！"],motivationAudioUrl:"",motivationAudioLocalPath:"",isMotivationAudioPlaying:!1,motivationScrollIntoView:"",motivationContentHeightPx:520,wheelImagePath:"",wheelSizePx:0,wheelRotation:0,wheelTransitionMs:0,isPredictingScore:!1,showSmsBanner:!1,smsTopPx:0,statusBarPx:24,navBarPx:44,navHeightPx:64,smsTitle:"【公务员平台】",smsBodyLine1:"同学你好，你以160分（第一名）的成绩入围面试，",smsBodyLine2:"请于3.25日前确认你是否参加面试。"},filterCategories:function(){var t=this,e=h().filter(function(e){return e.library===t.data.activeLibrary}),a=this.data.categoryLimit;this.setData({categories:e.slice(0,a),hasMoreCategories:e.length>a})},onLoadMoreCategories:function(){var t=this;this._categoryTouched=!0,this.setData({categoryLimit:this.data.categoryLimit+3},function(){t.filterCategories()})},onCollapseCategories:function(){var t=this;this._categoryTouched=!0;var e=h().filter(function(e){return e.library===t.data.activeLibrary}).slice(0,3).map(function(t){return t.id}),a={categoryLimit:3};e.includes(this.data.activeCategory)||Object.assign(a,{activeCategory:null,periods:[],expandedExams:{}}),this.setData(a,function(){return t.filterCategories()})},onSwitchLibrary:function(t){var e=this,a=t.currentTarget.dataset.type;["peanut","chaoge","fenbi"].includes(a)&&a!==this.data.activeLibrary&&(this._categoryTouched=!0,this.setData({activeLibrary:a,categoryLimit:3,activeCategory:null,periods:[],expandedExams:{}},function(){e.filterCategories()}))},noop:function(){},onLoad:function(t){var e=this;this._unloaded=!1,this._categoryTouched=!1,w&&(this.filterCategories(),this.initWheelSize(),this.computeNavMetrics(),this.computeSmsTop(),this.initMotivationAudio(),this.maybeShowMotivationOverlay(),this.refreshCatalog().then(function(){!e._unloaded&&!e._provinceCatalogRefreshTried&&(e._provinceCatalogRefreshTried=!0,h().some(function(t){return"peanut_26_guokao_2_fusheng"===t.id})&&h().some(function(t){return"fenbi"===t.library})||e.refreshCatalog(!0))}))},refreshCatalog:function(){var t=this,e=arguments.length>0&&void 0!==arguments[0]&&arguments[0];if(this._catalogPending)return e?this._catalogPending.then(function(){return t.refreshCatalog(!0)}):this._catalogPending;var a=g(e).then(function(e){if(!t._unloaded){var a=JSON.stringify(e);a!==t._catalogSignature&&(t._catalogSignature=a,u(e),t.setData({cloudExams:e.map(function(t){return t.setKey})}),t.filterCategories(),t.data.activeCategory&&t.loadHistoryForPeriods(t.data.activeCategory))}}).catch(function(t){return console.warn("Catalog refresh failed",t)});return this._catalogPending=a,a.finally(function(){t._catalogPending===a&&(t._catalogPending=null)})},onPullDownRefresh:function(){w?this.refreshCatalog(!0).finally(function(){return wx.stopPullDownRefresh()}):wx.stopPullDownRefresh()},preloadFirstExamLeaderboard:function(){var t=null;if(this.data.categories&&this.data.categories.length>0){var e=this.data.categories[0].id,a=(0,require("../../utils/data.js").getPeriods)(e);a&&a.length>0&&(t=a[0].examId)}if(t){console.log("[Preload] Starting preload for:",t);var i=require("../../utils/leaderboard-helper.js").fetchLeaderboardData,n=require("../../utils/cloud.js"),r=n.getOpenId,c=n.getUserProfile;Promise.all([r(),c()]).then(function(e){var a=o._(e,2),n=a[0],r=a[1];console.log("[Preload] User info fetched, fetching leaderboard...");var c=getApp();c.globalData||(c.globalData={}),c.globalData.userInfo={openid:n,profile:r},i(t,n,r).then(function(e){console.log("[Preload] Leaderboard fetched successfully:",e);var a={historyList:[],leaderboardList:e.leaderboardList,fullRankList:[],rawList:[],totalExamCount:e.totalCount,timestamp:Date.now()};c.globalData.leaderboardCache||(c.globalData.leaderboardCache={}),s.keepRecent(c.globalData.leaderboardCache,t,a);var i="leaderboard_cache_".concat(t);s.write(i,a),console.log("[Preload] Data cached to Global Memory & Storage:",i)}).catch(function(t){console.error("[Preload] Failed to fetch leaderboard:",t)})}).catch(function(t){console.error("[Preload] Failed to get user info:",t)})}},onLetterTap:function(t){wx.navigateTo({url:"/pages/letter/letter"})},onShow:function(){this._hidden=!1,w&&(this.refreshCatalog(),this.data.activeCategory&&this.loadHistoryForPeriods(this.data.activeCategory),this.computeNavMetrics(),this.computeSmsTop())},onUnload:function(){this._unloaded=!0,this.hideAnswerCardLoading();try{this.motivationAudioCtx&&(this.motivationAudioCtx.stop(),this.motivationAudioCtx.destroy(),this.motivationAudioCtx=null)}catch(t){}try{this.smsBannerTimer&&(clearTimeout(this.smsBannerTimer),this.smsBannerTimer=null)}catch(t){}},initWheelSize:function(){try{var t=wx.getSystemInfoSync(),e=t&&t.windowWidth?t.windowWidth:375,a=t&&t.windowHeight?t.windowHeight:667,i=Math.max(240,Math.min(320,Math.floor(.72*e))),o=Math.max(420,Math.min(620,Math.floor(.68*a)));this.setData({wheelSizePx:i,motivationContentHeightPx:o})}catch(t){this.setData({wheelSizePx:280,motivationContentHeightPx:520})}},computeNavMetrics:function(){try{var t=wx.getSystemInfoSync(),e=t&&t.statusBarHeight?t.statusBarHeight:24,a=t&&"string"==typeof t.system&&t.system.toLowerCase().indexOf("ios")>=0?44:48;this.setData({statusBarPx:e,navBarPx:a,navHeightPx:e+a})}catch(t){}},computeSmsTop:function(){try{var t=Math.max(0,Math.floor(this.data.statusBarPx+8));this.setData({smsTopPx:t})}catch(t){}},initMotivationAudio:function(){var t=this;if(!this.motivationAudioCtx){try{try{wx.setInnerAudioOption({obeyMuteSwitch:!1,speakerOn:!0})}catch(t){}this.motivationAudioCtx=wx.createInnerAudioContext(),this.motivationAudioCtx.obeyMuteSwitch=!1,this.motivationAudioCtx.onPlay(function(){t.setData({isMotivationAudioPlaying:!0})}),this.motivationAudioCtx.onPause(function(){t.setData({isMotivationAudioPlaying:!1})}),this.motivationAudioCtx.onStop(function(){t.setData({isMotivationAudioPlaying:!1})}),this.motivationAudioCtx.onEnded(function(){t.setData({isMotivationAudioPlaying:!1})}),this.motivationAudioCtx.onError(function(){t.setData({isMotivationAudioPlaying:!1})})}catch(t){}this.refreshMotivationAudioUrl()}},refreshMotivationAudioUrl:function(){return t._(function(){var t,e,a;return r._(this,function(i){switch(i.label){case 0:if(i.trys.push([0,2,,3]),(t=wx.getStorageSync("motivation_audio_url_cache"))&&t.url&&Date.now()-t.ts<6e6)return this.setData({motivationAudioUrl:t.url}),[2];return[4,m([p])];case 1:return(a=Array.isArray(e=i.sent())?e[0]:"")&&"string"==typeof a&&a.startsWith("http")&&(wx.setStorageSync("motivation_audio_url_cache",{url:a,ts:Date.now()}),this.setData({motivationAudioUrl:a})),[3,3];case 2:return i.sent(),[3,3];case 3:return[2]}})}).call(this)},ensureMotivationAudioLocalPath:function(){return t._(function(){var t;return r._(this,function(e){switch(e.label){case 0:if(this.data.motivationAudioLocalPath)return[2,this.data.motivationAudioLocalPath];e.label=1;case 1:return e.trys.push([1,3,,4]),[4,wx.cloud.downloadFile({fileID:p})];case 2:if((t=e.sent())&&t.tempFilePath)return this.setData({motivationAudioLocalPath:t.tempFilePath}),[2,t.tempFilePath];return[3,4];case 3:return e.sent(),[3,4];case 4:return[2,""]}})}).call(this)},maybeShowMotivationOverlay:function(){try{var t=new Date,e=t.getFullYear(),a=String(t.getMonth()+1).padStart(2,"0"),i=String(t.getDate()).padStart(2,"0"),o="".concat(e,"-").concat(a,"-").concat(i);if(wx.getStorageSync("motivation_last_shown")===o)return;wx.setStorageSync("motivation_last_shown",o),this.openMotivationOverlay()}catch(t){console.error("Error in maybeShowMotivationOverlay:",t),this.openMotivationOverlay()}},openMotivationOverlay:function(){var t=this;this.setData({showMotivationOverlay:!0,wheelRotation:0,wheelTransitionMs:0,motivationScrollIntoView:"motivation_top"}),setTimeout(function(){t.setData({motivationScrollIntoView:""})},300),setTimeout(function(){t.drawScoreWheel(function(){setTimeout(function(){return t.ensureWheelImageReady()},200)})},60)},closeMotivationOverlay:function(){this.setData({showMotivationOverlay:!1});try{this.motivationAudioCtx&&this.motivationAudioCtx.pause()}catch(t){}},ensureWheelImageReady:function(){var t=this;this.data.wheelImagePath||this.data.showMotivationOverlay&&this.drawScoreWheel(function(){var e=t.data.wheelSizePx||280;try{wx.canvasToTempFilePath({canvasId:"scoreWheel",destWidth:e,destHeight:e,success:function(e){e&&e.tempFilePath&&t.setData({wheelImagePath:e.tempFilePath})}},t)}catch(t){}})},drawScoreWheel:function(t){try{var e=this.data.wheelSizePx||280,a=wx.createCanvasContext("scoreWheel",this),i=e/2,o=i-6,n=[160,152,148,141,136,129,123,118,112,106,99,92],r=n.length,s=2*Math.PI/r,c=["#2C3E50","#55E6C1","#FAD390","#A2D2FF"];a.clearRect(0,0,e,e);for(var l=0;l<r;l++){var h=-Math.PI/2-s/2+l*s,u=h+s,d=c[l%c.length];a.beginPath(),a.moveTo(i,i),a.arc(i,i,o,h,u),a.closePath(),a.setFillStyle(d),a.fill()}a.beginPath(),a.arc(i,i,o,0,2*Math.PI),a.setStrokeStyle("#2C3E50"),a.setLineWidth(4),a.stroke();for(var f=0;f<r;f++){var g=-Math.PI/2+f*s,m=String(n[f]),v=i+.62*o*Math.cos(g),w=i+.62*o*Math.sin(g);a.save(),a.translate(v,w),a.rotate(g+Math.PI/2),a.setFillStyle("#ffffff"),a.setFontSize(Math.max(12,Math.floor(.05*e))),a.setTextAlign("center"),a.setTextBaseline("middle"),a.fillText(m,0,0),a.restore()}a.beginPath(),a.arc(i,i,Math.max(26,Math.floor(.12*e)),0,2*Math.PI),a.setFillStyle("#ffffff"),a.fill(),a.setStrokeStyle("#2C3E50"),a.setLineWidth(3),a.stroke(),a.setFillStyle("#2C3E50"),a.setFontSize(Math.max(14,Math.floor(.065*e))),a.setTextAlign("center"),a.setTextBaseline("middle"),a.fillText("160",i,i),a.draw(!1,function(){"function"==typeof t&&t()})}catch(t){}},vibrateDoubleStrong:function(){var t=function(){try{wx.vibrateLong()}catch(t){try{wx.vibrateShort({})}catch(t){try{wx.vibrateShort()}catch(t){}}}};try{wx.vibrateLong()}catch(t){try{wx.vibrateShort({})}catch(t){try{wx.vibrateShort()}catch(t){}}}setTimeout(function(){t()},260)},onPredictScoreTap:function(){var t=this;if(!this.data.isPredictingScore){this.data.wheelImagePath||this.ensureWheelImageReady();var e=360*(6+Math.floor(4*Math.random()))+(220*Math.random()-110);this.setData({isPredictingScore:!0,wheelTransitionMs:0}),setTimeout(function(){t.setData({wheelTransitionMs:4200,wheelRotation:t.data.wheelRotation+e})},50),setTimeout(function(){t.vibrateDoubleStrong(),t.showSmsNotification(),t.setData({isPredictingScore:!1})},4280)}},showSmsNotification:function(){var t=this;try{this.smsBannerTimer&&(clearTimeout(this.smsBannerTimer),this.smsBannerTimer=null)}catch(t){}this.setData({showSmsBanner:!0}),this.smsBannerTimer=setTimeout(function(){t.setData({showSmsBanner:!1}),t.smsBannerTimer=null},8700)},onMotivationFabTap:function(){this.openMotivationOverlay()},onMotivationMaskTap:function(){this.closeMotivationOverlay()},onMotivationCloseTap:function(){this.closeMotivationOverlay()},playMotivationAudio:function(){return t._(function(){var t;return r._(this,function(e){switch(e.label){case 0:if(e.trys.push([0,6,,7]),this.motivationAudioCtx||this.initMotivationAudio(),t=this.data.motivationAudioLocalPath)return[3,2];return[4,this.ensureMotivationAudioLocalPath()];case 1:t=e.sent(),e.label=2;case 2:if(t)return[3,5];if(this.data.motivationAudioUrl)return[3,4];return[4,this.refreshMotivationAudioUrl()];case 3:e.sent(),e.label=4;case 4:t=this.data.motivationAudioUrl,e.label=5;case 5:if(!t)return[2];this.motivationAudioCtx.src!==t&&(this.motivationAudioCtx.src=t);try{wx.setInnerAudioOption({obeyMuteSwitch:!1})}catch(t){}return this.motivationAudioCtx.play(),[3,7];case 6:e.sent();try{wx.showToast({title:"语音播放失败",icon:"none"})}catch(t){}return[3,7];case 7:return[2]}})}).call(this)},onMotivationToggleAudioTap:function(){if(!this.motivationAudioCtx)return void this.playMotivationAudio();if(this.data.isMotivationAudioPlaying)try{this.motivationAudioCtx.pause()}catch(t){}else this.playMotivationAudio()},loadHistoryForPeriods:function(e){var o=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return t._(function(){var t,n,s;return r._(this,function(r){switch(r.label){case 0:return t=l(e,this.data.cloudExams),0===this.data.periods.length&&this.setData({periods:t}),[4,f(o)];case 1:if(n=r.sent(),this._unloaded||this.data.activeCategory!==e)return[2];return s=t.map(function(t){var e=n.find(function(e){return e.examId===t.examId});return i._(a._({},t),{history:e?{score:e.score,date:new Date(e.timestamp).toLocaleDateString()}:null})}),this.setData({periods:s}),[2]}})}).call(this)},onToggleExamExpand:function(t){var o=this,r=t.currentTarget.dataset.id;if(r){var s=!!this.data.expandedExams[r],c=e._({},r,!s);if(this.setData({expandedExams:c}),!s){var l=this.data.periods.find(function(t){return t.examId===r});l&&!l.hasOnlineExam&&(console.log("Checking cloud status for ".concat(r,"...")),wx.showNavigationBarLoading(),wx.cloud.database().collection("exam_data").doc(r).field({_id:!0}).get().then(function(t){if(wx.hideNavigationBarLoading(),t.data){console.log("Cloud data found for ".concat(r,", updating UI..."));var e=n._(o.data.cloudExams);e.includes(r)||(e.push(r),o.setData({cloudExams:e}));var s=o.data.periods.map(function(t){return t.examId===r?i._(a._({},t),{hasOnlineExam:!0}):t});o.setData({periods:s}),wx.showToast({title:"试卷已更新",icon:"none"})}}).catch(function(t){wx.hideNavigationBarLoading(),console.log("Cloud check failed/not found for ".concat(r),t)}))}}},onGlobalClick:function(){var t=this;Object.keys(this.data.expandedExams).some(function(e){return t.data.expandedExams[e]})&&this.setData({expandedExams:{}})},onCategoryTap:function(t){var e=Date.now();console.log("[Perf] Category Tap Start:",e);var a=t.currentTarget.dataset.id;if(this._categoryTouched=!0,this.data.activeCategory===a)this.setData({activeCategory:null,periods:[]},function(){console.log("[Perf] Category Collapse Rendered:",Date.now(),"Duration:",Date.now()-e,"ms")});else{var i=l(a,this.data.cloudExams);this.setData({activeCategory:a,periods:i},function(){console.log("[Perf] Category Expand Rendered:",Date.now(),"Duration:",Date.now()-e,"ms")}),this.loadHistoryForPeriods(a)}},onMathToolsTap:function(){wx.navigateTo({url:"/pages/math-tools/menu/menu"})},onTimerSetupTap:function(){wx.navigateTo({url:"/pages/timer-setup/timer-setup"})},onFbToolTap:function(){wx.navigateTo({url:"/pages/fb-tool/fb-tool"})},onIdiomTap:function(){wx.navigateTo({url:"/pages/idiom/idiom"})},onExamTap:function(t){this._openingExam||(this._choiceExam=a._({},t.currentTarget.dataset),this.setData({showAnswerChoice:!0,choiceTitle:this._choiceExam.title||"当前试卷"}))},closeAnswerChoice:function(){this.setData({showAnswerChoice:!1})},onDownloadChoiceAnswerCard:function(){return t._(function(){var t;return r._(this,function(e){switch(e.label){case 0:if(t=this,this._unloaded||this._hidden||this._answerCardBusy)return[2];this._answerCardBusy=!0,this.setData({answerCardDownloading:!0}),this._answerCardLoadingVisible=!0,wx.showLoading({title:"打开答题卡...",mask:!0}),e.label=1;case 1:return e.trys.push([1,3,4,5]),[4,v(function(){return!t._unloaded&&!t._hidden})];case 2:return e.sent(),[3,5];case 3:return console.error("Answer card download/preview failed",e.sent()),this._unloaded||this._hidden||wx.showToast({title:"答题卡打开失败，请重试",icon:"none"}),[3,5];case 4:return this.hideAnswerCardLoading(),this._answerCardBusy=!1,this._unloaded||this.setData({answerCardDownloading:!1}),[7];case 5:return[2]}})}).call(this)},hideAnswerCardLoading:function(){this._answerCardLoadingVisible&&(this._answerCardLoadingVisible=!1,wx.hideLoading())},onHide:function(){this._hidden=!0,this.hideAnswerCardLoading()},keepAnswerChoiceOpen:function(){},onManualAnswer:function(){this.openChosenExam("manual")},onScanAnswer:function(){this.openChosenExam("scan")},openChosenExam:function(t){var e=this;if(!this._openingExam&&this._choiceExam){var a=this._choiceExam,i=a.id,o=a.title,n=void 0===o?"":o,r=this.data.categories.find(function(t){return t.id===e.data.activeCategory});this._openingExam=!0,wx.navigateTo({url:"/pages/exam/exam?examId=".concat(encodeURIComponent(i),"&mainTitle=").concat(encodeURIComponent(r?r.title:"模拟卷"),"&subTitle=").concat(encodeURIComponent(n),"&title=").concat(encodeURIComponent(n),"&entry=").concat(t),success:function(){return e.closeAnswerChoice()},fail:function(){return wx.showToast({title:"答题页打开失败，请重试",icon:"none"})},complete:function(){e._openingExam=!1}})}},onBtnTouchStart:function(){this.touchStartTime=Date.now()},onHistoryScoreTap:function(t){var e=this,a=t.currentTarget.dataset.id,i=t.currentTarget.dataset.title,o=this.data.categories.find(function(t){return t.id===e.data.activeCategory}),n=o?o.title:"模拟卷",r=getApp(),s=this.touchStartTime||Date.now();r.globalData.historyTapTime=s;var c=Date.now();console.log("[Perf Debug] 0. Touch Start:",s),console.log("[Perf Debug] 1. Tap Event (Finger Lift):",c,"Hold Duration:",c-s,"ms"),wx.navigateTo({url:"/pages/set-history/set-history?examId=".concat(a,"&mainTitle=").concat(encodeURIComponent(n),"&subTitle=").concat(encodeURIComponent(i))})},onGetMaterialTap:function(){this.setData({showContactBtn:!1}),this.setData({showMaterialModal:!0})},onMaterialModalClose:function(){this.setData({showMaterialModal:!1})},onShareAppMessage:function(){return{title:w?"考公刷题神器，快来试试吧！":"行测小助理\xb7常用工具",path:"/pages/index/index"}},onShareTimeline:function(){return{title:w?"考公刷题神器，快来试试吧！":"行测小助理\xb7常用工具"}},onAuthorLongPress:function(){var t=this;wx.showModal({title:"开发者后台",content:"请输入管理密码",editable:!0,placeholderText:"密码",success:function(e){e.confirm&&("admin"===e.content?t.showAdminMenu():wx.showToast({title:"密码错误",icon:"none"}))}})},showAdminMenu:function(){var t=this;wx.showActionSheet({itemList:["查看用户列表","一键生成静态JSON","查看错误反馈"],success:function(e){switch(e.tapIndex){case 0:wx.navigateTo({url:"/pages/user-list/user-list"});break;case 1:t.exportStaticData();break;case 2:wx.navigateTo({url:"/pages/admin/report-list/report-list"})}}})},exportStaticData:function(){wx.showLoading({title:"正在导出...",mask:!0}),(0,require("../../utils/generate_static.js").exportAll)().then(function(){wx.hideLoading(),wx.showModal({title:"导出完成",content:"JSON文件已上传至云存储 exam_data/ 目录。\n请在 utils/cloud.js 中配置 EXAM_DATA_CDN_URL 为您的云存储 HTTP 访问域名。",showCancel:!1})}).catch(function(t){wx.hideLoading(),wx.showToast({title:"导出失败",icon:"none"}),console.error(t)})}}); 
 			}); 	require("pages/index/index.js");
 		__wxRoute = 'pages/exam/exam';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/exam/exam.js';	define("pages/exam/exam.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../@swc/runtime/_async_to_generator"),e=require("../../@swc/runtime/_define_property"),i=require("../../@swc/runtime/_object_spread"),n=require("../../@swc/runtime/_object_spread_props"),a=require("../../@swc/runtime/_ts_generator"),s=require("../../utils/result-session.js"),r=require("../../utils/data.js"),o=r.getExamStructure,d=r.getCorrectAnswers,c=require("../../utils/live-scanner.js").createLiveScanner,u=require("../../utils/scan-submit-ad.js").createScanSubmitAd,h=require("../../utils/cloud.js").fetchExamData,l=require("../../utils/pdf-download.js").openAnswerCardPdf,w=require("../../utils/feature-flags.js"),S=w.QUESTION_BANK_ENABLED,g=w.redirectIfQuestionBankClosed,v=require("../../utils/exam-model.js"),f=v.OPTIONS,m=v.CARD_COUNT,_=v.normalizeSections,p=v.correctFromSections,x=v.sanitizeAnswers,y=v.structureKey,T=v.importScan,b=v.grade;Page({data:{dataReady:!1,scanSupported:!1,scanMessage:"",reviewMap:{},reviewQuestions:[],isSubmitting:!1,answerCardDownloading:!1,answeredCount:0,blankCount:0,editQuestion:null,gridScrollInto:"",entryMode:"manual",scanStage:!1,scanAdStage:"idle",scanAdError:"",scanner:{phase:"idle",hint:"试卷加载完成后自动开启持续扫描",progress:0,required:2},scanStructureKey:"",examId:"",title:"",mainTitle:"",subTitle:"",structure:[],currentSectionIndex:0,currentQuestions:[],answers:{},totalQuestions:0,showConfirmModal:!1,windowHeight:0,cloudExamData:null,mode:"list",currentGlobalIndex:1,singleCurrentQuestion:{id:"q_1",num:1},isSheetVisible:!0,allQuestions:[],swiperCurrent:0,listScrollTop:0,sheetHeight:350,isDragging:!1},startY:0,startHeight:0,onLoad:function(t){var e=this;if(!g()){this._unloaded=!1,this._hidden=!1;var i=function(t){try{return decodeURIComponent(t||"")}catch(e){return t||""}},n=t.examId||"";if(this._entryScan="scan"===t.entry||"photo"===t.entry,this._requiresScanAd=this._entryScan,this.setData({examId:n,entryMode:this._entryScan?"scan":"manual",scanStage:this._entryScan,title:i(t.title),mainTitle:i(t.mainTitle),subTitle:i(t.subTitle),windowHeight:wx.getSystemInfoSync().windowHeight}),!n){wx.showToast({title:"请先选择试卷",icon:"none"}),wx.navigateBack();return}this.rebuildStructureFromCloud(o(n)),this.loadExamData(!1).then(function(){!e._unloaded&&e._entryScan&&e.data.dataReady&&(e.data.scanSupported||e.useManual())})}},loadExamData:function(t){var e=this,i=this.data.examId,n=this._loadTicket=(this._loadTicket||0)+1,a="force_update_".concat(i),s=t||!!wx.getStorageSync(a);return this.disposeLiveScanner(),this.setData({dataReady:!1}),Promise.resolve().then(function(){return h(i,s)}).then(function(t){if(!e._unloaded&&n===e._loadTicket){if(t&&Array.isArray(t.sections)&&t.sections.length){var r=_(t.sections),o=p(t.sections);e.rebuildStructureFromCloud(r),e.correctAnswers=o,e.setData({cloudExamData:t}),s&&wx.removeStorageSync(a)}else t&&("string"==typeof t.answers||Array.isArray(t.answers))?(e.correctAnswers=p([{count:e.data.totalQuestions,answers:t.answers}]),e.setData({cloudExamData:t}),s&&wx.removeStorageSync(a)):e.correctAnswers=d(i);e.setData({dataReady:Object.keys(e.correctAnswers||{}).length>0}),e.data.dataReady||wx.showToast({title:"暂无该试卷答案，请稍后再试",icon:"none"}),e.data.dataReady&&e.data.scanStage&&e.data.scanSupported&&e.mountContinuousScanner()}}).catch(function(t){!e._unloaded&&n===e._loadTicket&&(console.warn("Exam data unavailable",t),e.correctAnswers=e.correctAnswers||d(i),e.setData({dataReady:Object.keys(e.correctAnswers||{}).length>0}),wx.showToast({title:e.data.dataReady?"使用已有试卷数据":"试卷加载失败，请重试",icon:"none"}),e.data.dataReady&&e.data.scanStage&&e.data.scanSupported&&e.mountContinuousScanner())})},rebuildStructureFromCloud:function(t){var e=_(t),a=this.data.structure.length&&y(this.data.structure)!==y(e),s=1,r=[],o=e.map(function(t,e){var a=s,o=Array.from({length:t.count},function(){var t=s++,i={id:"q_".concat(t),num:t,sectionIndex:e};return r.push(i),i});return n._(i._({},t),{startIndex:a,endIndex:s-1,questionList:o})}),d=s-1;if(a){var c=Object.keys(this.data.answers||{}).length>0||Object.keys(this.data.reviewMap||{}).length>0;this._scanImported=!1,this.resetScanSubmitAd(),this._scanTicket=(this._scanTicket||0)+1,this.setData({answers:{},reviewMap:{},reviewQuestions:[],editQuestion:null,scanStage:"scan"===this.data.entryMode,scanMessage:""}),c&&wx.showToast({title:"题目调整，已清空原答案",icon:"none"})}this.setData({structure:o,allQuestions:r,totalQuestions:d,scanStructureKey:y(e),currentSectionIndex:0,currentQuestions:this.generateQuestions(o[0]),swiperCurrent:0,currentGlobalIndex:1,singleCurrentQuestion:r[0],listScrollTop:0,scanSupported:d<=m,answers:x(this.data.answers,d)}),this.updateAnswerCounts()},mountContinuousScanner:function(){var t=this;!this._unloaded&&this.data.dataReady&&this.data.scanStage&&!this._liveScanner&&(this._liveScanner=c(this),wx.setNavigationBarTitle&&wx.setNavigationBarTitle({title:"识别答题卡"}),this._liveScanner.start(),wx.nextTick&&wx.nextTick(function(){return t.fitScannerGuide()}))},fitScannerGuide:function(){var t=this;!this._unloaded&&this.data.scanStage&&wx.createSelectorQuery&&wx.createSelectorQuery().select(".continuous-camera-box").boundingClientRect(function(e){if(e&&e.width&&e.height&&!t._unloaded&&t.data.scanStage){var i=74*((wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync()).windowWidth||375)/750,n=Math.max(0,Math.min(.86*e.width-i,(.86*e.height-i)*747/803));t.setData({scannerGuideStyle:"width:"+(n+i)+"px;height:"+(803*n/747+i)+"px;"})}}).exec()},disposeLiveScanner:function(){this._liveScanner&&(this._liveScanner.onUnload(),this._liveScanner=null)},onLiveCameraReady:function(t){this.fitScannerGuide(),this._liveScanner&&this._liveScanner.cameraReady(t)},onLiveCameraError:function(t){this._liveScanner&&this._liveScanner.cameraError(t)},pauseLiveScan:function(){this._liveScanner&&this._liveScanner.stop()},toggleScanTorch:function(){this._liveScanner&&this._liveScanner.toggleTorch()},captureScanPhoto:function(){this._liveScanner&&("idle"===this._liveScanner.data.phase?this._liveScanner.start():this._liveScanner.capturePhoto())},copyScanPhotoDiagnostics:function(){this._liveScanner&&this._liveScanner.copyPhotoDiagnostics()},changeScanCaptureMode:function(t){this._liveScanner&&this._liveScanner.setCaptureMode(t.currentTarget.dataset.mode)},resumeLiveScan:function(){this._liveScanner?this._liveScanner.start():this.mountContinuousScanner()},useSystemScanCamera:function(){this._liveScanner&&this._liveScanner.captureSystemPhoto()},onDownloadAnswerCard:function(){return t._(function(){var t;return a._(this,function(e){switch(e.label){case 0:if(t=this,this._unloaded||this._hidden||this._answerCardBusy||["capturing","photoProcessing"].includes(this.data.scanner.phase))return[2];this._answerCardBusy=!0,this.setData({answerCardDownloading:!0}),this.pauseLiveScan(),this._cardLoadingVisible=!0,wx.showLoading({title:"打开答题卡...",mask:!0}),e.label=1;case 1:return e.trys.push([1,3,4,5]),[4,l(function(){return!t._unloaded&&!t._hidden})];case 2:return e.sent(),[3,5];case 3:return console.error("Answer card download/preview failed",e.sent()),this._unloaded||this._hidden||wx.showToast({title:"答题卡打开失败，请重试",icon:"none"}),[3,5];case 4:return this.hideAnswerCardLoading(),this._answerCardBusy=!1,this._unloaded||this.setData({answerCardDownloading:!1}),[7];case 5:return[2]}})}).call(this)},hideAnswerCardLoading:function(){this._cardLoadingVisible&&(this._cardLoadingVisible=!1,wx.hideLoading())},agreeLivePrivacy:function(){this._liveScanner&&this._liveScanner.agreePrivacy()},rejectLivePrivacy:function(){this._liveScanner&&this._liveScanner.rejectPrivacy()},openLivePrivacy:function(){this._liveScanner&&this._liveScanner.openPrivacy()},livePermissionsChanged:function(t){this._liveScanner&&this._liveScanner.permissionsChanged(t)},updateAnswerCounts:function(){var t=Object.keys(x(this.data.answers,this.data.totalQuestions)).length;this.setData({answeredCount:t,blankCount:this.data.totalQuestions-t-this.data.reviewQuestions.length})},useManual:function(){this.data.isSubmitting||this._scanImported||(this._requiresScanAd=!1,this.data.scanSupported||"scan"!==this.data.entryMode||wx.showToast({title:"本卷超过140题，请手动录入",icon:"none"}),this.disposeLiveScanner(),wx.setNavigationBarTitle&&wx.setNavigationBarTitle({title:"正在答题"}),this.setData({entryMode:"manual",scanStage:!1,mode:"list",editQuestion:null}))},editAnswer:function(t){if(this.data.dataReady&&!this.data.isSubmitting){var e=this.data.allQuestions.find(function(e){return e.id===t.currentTarget.dataset.qid});if(e){var a=this.data.reviewQuestions.find(function(t){return t.id===e.id});this.setData({editQuestion:n._(i._({},e),{reviewReason:a&&a.reason||"",candidate:a&&a.candidate||""})})}}},closeEditor:function(){this.setData({editQuestion:null})},keepEditorOpen:function(){},editOption:function(t){this.data.editQuestion&&(this.onOptionTap({currentTarget:{dataset:{qid:this.data.editQuestion.id,option:t.currentTarget.dataset.option}}}),this.closeEditor())},editBlank:function(){this.data.editQuestion&&(this.leaveBlank({currentTarget:{dataset:{qid:this.data.editQuestion.id}}}),this.closeEditor())},openScanner:function(){var t=this;if(this.data.dataReady&&!this.data.isSubmitting&&"scan"===this.data.entryMode){if(!this.data.scanSupported)return void this.useManual();var e=function(){!t._unloaded&&t.data.dataReady&&(t.setData({scanStage:!0,editQuestion:null}),t.mountContinuousScanner())};Object.keys(this.data.answers).length||this.data.reviewQuestions.length?wx.showModal({title:"重新识别",content:"识别成功后会替换本页答案，包括纸卡上的空题；识别失败或取消会保留当前答案。",success:function(t){t.confirm&&e()}}):e()}},cancelScanner:function(){this.disposeLiveScanner(),this.setData({scanStage:!1,mode:"grid"})},onScanComplete:function(t){if(!this._unloaded&&this.data.dataReady&&this.data.scanStage&&"scan"===this.data.entryMode)try{if(!t.detail||!t.detail.meta||t.detail.meta.structureKey!==this.data.scanStructureKey||t.detail.meta.questionCount!==this.data.totalQuestions)throw Error("试卷结构已更新，请重新识别");var e=T(t.detail,this.data.examId,this.data.totalQuestions),i=e.ignoredFilled+e.ignoredReview,n=(e.reviewQuestions.length?"部分题目未读清，本卷共":"识别完成，本卷共")+this.data.totalQuestions+"题，已识别"+Object.keys(e.answers).length+"个答案"+(i?"；第"+(this.data.totalQuestions+1)+"–140格有"+i+"个填涂/疑似填涂，已忽略，不计分":"")+(e.reviewQuestions.length?"；红色题目需核对，点击题号即可修改或补充答案":"；点击题号可修改或补充答案，核对完成后观看广告并交卷");this.disposeLiveScanner(),this._scanImported=!0,this._requiresScanAd=!0,this.resetScanSubmitAd(),wx.setNavigationBarTitle&&wx.setNavigationBarTitle({title:"核对答题卡"}),this.setData({answers:e.answers,reviewMap:e.reviewMap,reviewQuestions:e.reviewQuestions,scanMessage:n,mode:"grid",scanStage:!1,editQuestion:null,gridScrollInto:""}),this.updateAnswerCounts()}catch(t){wx.showToast({title:t.message,icon:"none"})}},onShow:function(){S&&(this._hidden=!1,this._openingScanner=!1,this._liveScanner&&this._liveScanner.onShow())},onHide:function(){this._hidden=!0,this.hideAnswerCardLoading(),clearTimeout(this._nextTimer),this._liveScanner&&this._liveScanner.onHide()},onUnload:function(){this._hidden=!0,this.hideAnswerCardLoading(),this.disposeLiveScanner(),this._scanSubmitAd&&this._scanSubmitAd.destroy(),this._unloaded=!0,this._loadTicket++,this._scanTicket++,clearTimeout(this._nextTimer)},resetScanSubmitAd:function(){this._scanSubmitAd?this._scanSubmitAd.reset():this.setData({scanAdStage:"idle",scanAdError:""})},scanSubmissionUnlocked:function(){return!this._requiresScanAd||!!(this._scanSubmitAd&&this._scanSubmitAd.canSubmit())},resolveReview:function(t){if(this.data.reviewMap[t]){var e=i._({},this.data.reviewMap);delete e[t],this.setData({reviewMap:e,reviewQuestions:this.data.reviewQuestions.filter(function(e){return e.id!==t})}),this.updateAnswerCounts()}},leaveBlank:function(t){if(this.data.dataReady&&!this.data.isSubmitting){var e=t.currentTarget.dataset.qid;if(this.data.allQuestions.some(function(t){return t.id===e})){var n=i._({},this.data.answers);delete n[e],this.setData({answers:n}),this.resolveReview(e),this.updateAnswerCounts()}}},onReviewTap:function(t){var e=this.data.allQuestions.find(function(e){return e.id===t.currentTarget.dataset.qid});if(e){if("grid"===this.data.mode){var a=this.data.reviewQuestions.find(function(t){return t.id===e.id});this.setData({gridScrollInto:"grid_"+e.id,editQuestion:n._(i._({},e),{reviewReason:a&&a.reason||"",candidate:a&&a.candidate||""})});return}this.switchSection(e.sectionIndex),this.setData({mode:"single",swiperCurrent:e.num-1,currentGlobalIndex:e.num,singleCurrentQuestion:e})}},generateQuestions:function(t){var e=[];if(!t)return e;for(var i=t.startIndex;i<=t.endIndex;i++)e.push({id:"q_".concat(i),num:i});return e},toggleMode:function(){if("scan"!==this.data.entryMode){var t="list"===this.data.mode?"single":"list";if("single"===t){var e=this.data.structure[this.data.currentSectionIndex],i=this.data.currentGlobalIndex;(i<e.startIndex||i>e.endIndex)&&(i=e.startIndex),this.setData({swiperCurrent:i-1,currentGlobalIndex:i,singleCurrentQuestion:this.data.allQuestions[i-1]})}else{var n=this.data.currentGlobalIndex,a=this.data.structure.findIndex(function(t){return n>=t.startIndex&&n<=t.endIndex});-1!==a&&a!==this.data.currentSectionIndex&&this.switchSection(a)}this.setData({mode:t})}},onSectionTap:function(t){var e=t.currentTarget.dataset.index;if(this.data.structure[e]&&e!==this.data.currentSectionIndex&&(this.switchSection(e),"single"===this.data.mode)){var i=this.data.structure[e];this.setData({swiperCurrent:i.startIndex-1,currentGlobalIndex:i.startIndex,singleCurrentQuestion:this.data.allQuestions[i.startIndex-1]})}},onPrevSection:function(){this.data.currentSectionIndex>0&&this.switchSection(this.data.currentSectionIndex-1)},onNextSection:function(){this.data.currentSectionIndex<this.data.structure.length-1&&this.switchSection(this.data.currentSectionIndex+1)},switchSection:function(t){var e=this.data.structure[t];if(e){var i=this.generateQuestions(e);this.setData({currentSectionIndex:t,currentQuestions:i,listScrollTop:0})}},onOptionTap:function(t){var a=t.currentTarget.dataset,s=a.qid,r=a.option;if(this.data.dataReady&&!this.data.isSubmitting&&f.includes(r)&&this.data.allQuestions.some(function(t){return t.id===s})){this.resolveReview(s);var o=n._(i._({},this.data.answers),e._({},s,r));this.setData({answers:o}),this.updateAnswerCounts()}},onSingleOptionTap:function(t){var a=this,s=t.currentTarget.dataset,r=s.qid,o=s.option;if(this.data.dataReady&&!this.data.isSubmitting&&f.includes(o)&&this.data.allQuestions.some(function(t){return t.id===r})){this.resolveReview(r);var d=n._(i._({},this.data.answers),e._({},r,o));this.setData({answers:d}),this.updateAnswerCounts(),clearTimeout(this._nextTimer),this._nextTimer=setTimeout(function(){a._unloaded||a.data.singleCurrentQuestion.id!==r||a.onNextSingle()},100)}},toggleSheet:function(){this.setData({isSheetVisible:!this.data.isSheetVisible})},onSwiperChange:function(t){var e=t.detail.current;if(this.data.allQuestions[e]){this.setData({swiperCurrent:e,currentGlobalIndex:e+1,singleCurrentQuestion:this.data.allQuestions[e]});var i=this.data.allQuestions[e];i&&i.sectionIndex!==this.data.currentSectionIndex&&this.setData({currentSectionIndex:i.sectionIndex})}},onNextSingle:function(){this.data.swiperCurrent<this.data.totalQuestions-1?this.setData({swiperCurrent:this.data.swiperCurrent+1}):wx.showToast({title:"已经是最后一题了",icon:"none"})},onSheetItemTap:function(t){var e=Number(t.currentTarget.dataset.globalIndex);!Number.isInteger(e)||e<1||e>this.data.totalQuestions||this.setData({swiperCurrent:e-1})},hasCompleteAnswerKey:function(){var t=x(this.correctAnswers,this.data.totalQuestions),e=0;return _(this.data.structure).every(function(i){for(var n=!0,a=0;a<i.count;a++)e++,i.scored&&!t["q_".concat(e)]&&(n=!1);return n})},onSubmitTap:function(){var t=this;if(!this._unloaded&&!this.data.scanStage&&!this.data.isSubmitting&&!this._confirmingSubmit){if(!this.data.dataReady)return void wx.showToast({title:"请等待试卷加载完成",icon:"none"});if(this.data.reviewQuestions.length){wx.showToast({title:"请先核对红色题目",icon:"none"}),this.onReviewTap({currentTarget:{dataset:{qid:this.data.reviewQuestions[0].id}}});return}if(!this.hasCompleteAnswerKey())return void wx.showToast({title:"标准答案不完整，请刷新后再交卷",icon:"none"});if(!this.scanSubmissionUnlocked()){this._scanSubmitAd||(this._scanSubmitAd=u(this)),this._scanSubmitAd.watch();return}this.setData({answers:x(this.data.answers,this.data.totalQuestions)});var e=Object.keys(this.data.answers).length,i=this.data.totalQuestions;e<i?(this._confirmingSubmit=!0,wx.showModal({title:"提示",content:"还有 ".concat(i-e," 道题未做，确定交卷吗？"),confirmText:"交卷",cancelText:"继续做题",complete:function(){t._confirmingSubmit=!1},success:function(e){e.confirm&&t.calculateAndFinish()}})):this.calculateAndFinish()}},calculateAndFinish:function(){var t=this;if(!this._unloaded&&!this.data.scanStage&&!this.data.isSubmitting&&this.data.dataReady&&!this.data.reviewQuestions.length){if(!this.scanSubmissionUnlocked())return void wx.showToast({title:"请先完成扫描交卷广告",icon:"none"});var e=this.data,a=e.examId,r=e.title,o=_(this.data.structure),d=x(this.data.answers,this.data.totalQuestions),c=x(this.correctAnswers,this.data.totalQuestions),u=0;if(o.some(function(t){for(var e=!1,i=0;i<t.count;i++)u++,t.scored&&!c["q_".concat(u)]&&(e=!0);return e}))return void wx.showToast({title:"标准答案不完整，请刷新后再交卷",icon:"none"});this.setData({isSubmitting:!0}),wx.showLoading({title:"正在交卷",mask:!0});try{s.set(n._(i._({examId:a,title:r,mainTitle:this.data.mainTitle,subTitle:this.data.subTitle},b(d,c,o,a)),{userAnswers:d,correctAnswers:c,examStructure:o,timestamp:Date.now()})),wx.redirectTo({url:"/pages/result/result",fail:function(){t.setData({isSubmitting:!1}),wx.showToast({title:"成绩页打开失败，请重试",icon:"none"})},complete:function(){return wx.hideLoading()}})}catch(t){wx.hideLoading(),this.setData({isSubmitting:!1}),wx.showToast({title:"成绩保存失败，请重试",icon:"none"})}}},onDragStart:function(t){this.lastY=t.touches[0].clientY,this.setData({isDragging:!0})},onDragMove:function(t){if(this.data.isDragging){var e=t.touches[0].clientY,i=this.lastY-e;this.lastY=e;var n=this.data.sheetHeight+i,a=.8*this.data.windowHeight;n<60&&(n=60),n>a&&(n=a),this.setData({sheetHeight:n})}},onDragEnd:function(){this.setData({isDragging:!1})},onShareAppMessage:function(){var t=this.data,e=t.examId,i=t.title,n=t.mainTitle,a=t.subTitle;return{title:"我正在挑战《".concat(i,"》，你也来试试？"),path:"/pages/exam/exam?examId=".concat(e,"&title=").concat(encodeURIComponent(i),"&mainTitle=").concat(encodeURIComponent(n),"&subTitle=").concat(encodeURIComponent(a))}},onShareTimeline:function(){var t=this.data,e=t.examId,i=t.title;return{title:"我正在挑战《".concat(i,"》，你也来试试？"),query:"examId=".concat(e,"&title=").concat(i)}},onPullDownRefresh:function(){!this.data.examId||this.data.isSubmitting||this._scanSubmitAd&&this._scanSubmitAd.isBusy()?wx.stopPullDownRefresh():this.loadExamData(!0).finally(function(){return wx.stopPullDownRefresh()})}}); 
 			}); 	require("pages/exam/exam.js");
 		__wxRoute = 'pages/result/result';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/result/result.js';	define("pages/result/result.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../@swc/runtime/_async_to_generator"),e=require("../../@swc/runtime/_define_property"),a=require("../../@swc/runtime/_object_spread"),s=require("../../@swc/runtime/_object_spread_props"),r=require("../../@swc/runtime/_ts_generator"),n=require("../../utils/local-cache.js"),i=require("../../utils/result-session.js"),o=require("../../utils/history-detail.js"),l=require("../../utils/image-export.js"),c=require("../../utils/runtime-diagnostics.js"),d=require("../../utils/data.js"),u=require("../../utils/answer-compat.js"),h=u.hasAnswerPayload,f=u.restoreUserAnswers,g=u.normalizeAnswers,m=u.encodeAnswers,x=require("../../utils/feature-flags.js"),p=x.QUESTION_BANK_ENABLED,b=x.COMPACT_HISTORY_WRITES_ENABLED,S=x.redirectIfQuestionBankClosed,v=require("../../utils/exam-model.js"),w=v.normalizeSections,y=v.correctFromSections,_=v.structureKey;require("../../utils/event-bus.js");var C=require("../../utils/stats-snapshot.js").rankFromSnapshot,T=require("../../utils/cloud.js"),A=T.getOpenId,k=T.fetchExamRankStats,D=T.fetchExamData,E=T.getUserProfile,I=T.saveExamRecord,R=d.examStructure||[{id:"sec1",name:"政治理论",count:20},{id:"sec2",name:"常识判断",count:15},{id:"sec3",name:"言语理解",count:30},{id:"sec4",name:"数量关系",count:10},{id:"sec5",name:"图形推理",count:10},{id:"sec6",name:"定义判断",count:10},{id:"sec7",name:"类比推理",count:5},{id:"sec8",name:"逻辑判断",count:10},{id:"sec9",name:"资料分析",count:20}];console.log("Result Page - Imported:",d),console.log("Result Page - examStructure:",R);var F=function(t,e){var a=String(t||"").startsWith("26-huasheng-shiye-A")?[0,90,105,120]:[0,60,70,80],s=(e?Object.keys(e):[]).map(function(t){return parseInt(t,10)}).filter(function(t){return!isNaN(t)}),r=a.every(function(t){return e&&e[String(t)]})?a:s.length>0?Array.from(new Set(s)).sort(function(t,e){return t-e}):a;return(r.includes(0)?r:[0].concat(r)).map(function(t){return{val:t,label:0===t?"全员":">".concat(t)}})};Page({data:{score:0,correctCount:0,wrongCount:0,unansweredCount:0,totalQuestions:0,sectionResults:[],historySaved:!1,saveStatus:"",detailsUnavailable:!1,leaderboardList:[],leaderboardLoading:!1,leaderboardLoadError:!1,rankLoadError:!1,showFullLeaderboard:!1,currentUserOpenId:"",currentUserProfile:null,showLoginModal:!1,tempAvatar:"",tempNickname:"",showDetailModal:!1,selectedUser:null,currentDetailIndex:-1,examTitle:"",mainTitle:"",subTitle:"",percent:null,canvasWidth:385,canvasHeight:667,showReportModal:!1,reportDesc:"",rank:null,totalSubmissions:null,hasCalculatedRank:!1,isAdvancedMode:!0,questionStats:null,sectionCollapsed:{},rawStats:[],filteredQuestionStats:null,currentScoreFilter:0,fullQuestionStats:null,scoreFilterOptions:F("",null),rankStatsRepairTried:!1},onFilterChange:function(t){var e=parseInt(t.currentTarget.dataset.val);if(e!==this.data.currentScoreFilter){var a=this.data.filteredQuestionStats||{},s=a[String(e)]||a[e];if(s)return void this.setData({currentScoreFilter:e,questionStats:s});this.setData({currentScoreFilter:e}),this.recalcStats(e)}},recalcStats:function(t){if(!this.data.rawStats||0===this.data.rawStats.length){0===t&&this.data.fullQuestionStats&&this.setData({questionStats:this.data.fullQuestionStats});return}var e=0===t?this.data.rawStats:this.data.rawStats.filter(function(e){return Number(e.s)>t}),a={},s={};this.data.sectionResults.forEach(function(t){t.questions.forEach(function(t){var e=String(t.num);a[e]=t.cAns,s["q_".concat(e)]={c:0,t:0,distCount:{A:0,B:0,C:0,D:0}}})}),e.forEach(function(t){t&&t.a&&Object.keys(t.a).forEach(function(e){var r=String(e),n=r.startsWith("q_")?r.slice(2):r,i="q_".concat(n),o=String(t.a[e]||"").trim().toUpperCase();o&&(s[i]||(s[i]={c:0,t:0,distCount:{A:0,B:0,C:0,D:0}}),s[i].t++,void 0===s[i].distCount[o]&&(s[i].distCount[o]=0),s[i].distCount[o]++,a[n]&&o===a[n]&&s[i].c++)})});var r={};Object.keys(s).forEach(function(t){var e=s[t],a=e.t||0,n={};Object.keys(e.distCount).forEach(function(t){var s=e.distCount[t]||0;n[t]=a>0?Math.round(s/a*100):0}),r[t]={acc:a>0?Math.round(e.c/a*100):0,count:a,dist:n,distCount:e.distCount}}),this.setData({questionStats:r})},setAdvancedMode:function(t){if(t!==this.data.isAdvancedMode){var e={isAdvancedMode:t};if(t){var a={};this.data.sectionResults.forEach(function(t,e){a[t.name]=0!==e}),e.sectionCollapsed=a}else e.sectionCollapsed={};this.setData(e),t&&!this.data.questionStats&&this.loadQuestionStats()}},toggleAdvancedMode:function(){this.setAdvancedMode(!this.data.isAdvancedMode)},onViewModeTap:function(t){var e=t.currentTarget.dataset.mode;this.setAdvancedMode("detail"===e)},toggleSection:function(t){var a=t.currentTarget.dataset.name,s=this.data.sectionCollapsed[a];this.setData(e._({},"sectionCollapsed.".concat(a),!s))},loadQuestionStats:function(){var e=arguments.length>0&&void 0!==arguments[0]&&arguments[0];return t._(function(){var t,a;return r._(this,function(s){switch(s.label){case 0:if(!e&&this.data.questionStats||!(t=this.data.examId))return[2];wx.showLoading({title:"加载统计..."}),s.label=1;case 1:return s.trys.push([1,3,4,5]),[4,k(t,e)];case 2:return(a=s.sent())&&!this._unloaded&&this.applyRankSnapshot(a,this.data.score,this.data.currentUserOpenId),[3,5];case 3:return console.error("Failed to load question stats",s.sent()),wx.showToast({title:"统计加载失败",icon:"none"}),[3,5];case 4:return this._unloaded||this._imageJob||wx.hideLoading(),[7];case 5:return[2]}})}).call(this)},onReportError:function(){this.setData({showReportModal:!0,reportDesc:"",contactInfo:""})},onCloseReportModal:function(){this.setData({showReportModal:!1})},onReportInput:function(t){this.setData({reportDesc:t.detail.value})},onContactInput:function(t){this.setData({contactInfo:t.detail.value})},onSubmitReport:function(){return t._(function(){var t,e;return r._(this,function(a){switch(a.label){case 0:if(!this.data.reportDesc.trim())return wx.showToast({title:"请输入描述",icon:"none"}),[2];wx.showLoading({title:"提交中..."}),a.label=1;case 1:return a.trys.push([1,3,,4]),[4,(0,require("../../utils/cloud.js").addErrorReport)({examId:this.data.examId,mainTitle:this.data.mainTitle,subTitle:this.data.subTitle,description:this.data.reportDesc,contact:this.data.contactInfo||"",userInfo:this.data.currentUserProfile||{}})];case 2:return t=a.sent(),wx.hideLoading(),t&&t.success?(this.setData({showReportModal:!1}),wx.showToast({title:"已上报",icon:"success"})):wx.showToast({title:t&&t.msg?t.msg:"上报失败",icon:"none",duration:3e3}),[3,4];case 3:return e=a.sent(),wx.hideLoading(),console.error("Report failed",e),wx.showToast({title:"出错啦",icon:"none"}),[3,4];case 4:return[2]}})}).call(this)},onSaveImage:function(){var t=this;this._imageJob||this._unloaded||wx.showActionSheet({itemList:["长截图","精简图","细节图"],success:function(e){0===e.tapIndex&&t.generateShareImage("long"),1===e.tapIndex&&t.generateShareImage("compact"),2===e.tapIndex&&t.generateShareImage("details")}})},generateShareImage:function(e){return t._(function(){var t,s,n,i,o,d,u,h,f,g,m,x,p,b,S,v,w,y,_,C,T,A,k,D,E,I,R,F,L,U,M,P,q,B,j,O,N,Q,H,J,W,z,K,Y,V,G,X,Z,$,tt,te,ta,ts,tr,tn,ti,to,tl,tc,td,tu,th,tf,tg,tm,tx,tp,tb,tS,tv,tw,ty,t_,tC,tT,tA,tk,tD,tE,tI,tR,tF,tL,tU,tM,tP,tq,tB,tj,tO,tN,tQ,tH,tJ,tW,tz,tK,tY,tV,tG,tX,tZ,t$,t0,t2,t1,t5,t4,t3,t8,t6,t7,t9,et,ee,ea,es,er,en,ei,eo,el,ec,ed,eu,eh,ef;return r._(this,function(r){switch(r.label){case 0:if(t=this,this._unloaded||this._imageJob)return[2];if(!this.data.sectionResults.length||this.data.detailsUnavailable)return wx.showToast({title:"请等待成绩详情加载完成",icon:"none"}),[2];s=l.createJob(),this._imageJob=s,wx.showLoading({title:"生成中...",mask:!0}),c.record("image.start",{mode:e}),r.label=1;case 1:return r.trys.push([1,6,7,8]),[4,s.wait(function(e){return t.createSelectorQuery().select("#shareCanvas").fields({node:!0,size:!0}).exec(e)})];case 2:if(n=r.sent(),s.check(),!(i=n&&n[0]&&n[0].node)||(s.canvas=i,!(o=i.getContext("2d"))))throw Error("图片画布未就绪，请重试");return d=this.data.currentUserProfile||{},[4,l.avatarImage(i,d.avatar||d.avatarUrl,s)];case 3:if(u=r.sent(),f=(h="details"===e?1200:375)-40,g=0,x=0,p=0,b=0,S=0,g="details"===e?190:100+(m=this.data.subTitle?80:50)+(p=8)+(x=125)+(b=20),v=this.data.sectionResults,w=0,"details"===e)for(y=((f-40-40)/3-32)/5*.75+26,_=0;_<v.length;_+=3)C=v[_],T=v[_+1],A=v[_+2],k=45+Math.ceil(C.questions.length/5)*(y+8)+10,D=0,T&&(D=45+Math.ceil(T.questions.length/5)*(y+8)+10),E=0,A&&(E=45+Math.ceil(A.questions.length/5)*(y+8)+10),w+=Math.max(k,D,E)+40;else if("long"===e){for(I=((f-40-20)/2-16)/5,R=0,F=0,L=v.map(function(t){return 18+(Math.ceil(t.questions.length/5)*(I+4)+5)}),U=1/0,S=Math.ceil(v.length/2),M=1;M<v.length;M++){for(B=0,P=0,q=0;B<M;B++)B>0&&(P+=25),P+=L[B];for(j=M;j<v.length;j++)j>M&&(q+=25),q+=L[j];(O=Math.abs(P-q))<U&&(U=O,S=M)}v.forEach(function(t,e){var a=L[e];e<S?(e>0&&(R+=25),R+=a):(e>S&&(F+=25),F+=a)}),w=Math.max(R,F)}else w=75*Math.ceil(v.length/3);if(N=g+w+40+10,s.check(),Q=l.bitmapSize(h,N,e),i.width=Q.width,i.height=Q.height,o.scale(Q.scale,Q.scale),c.record("image.bitmap",a._({mode:e},Q)),o.fillStyle="#FFFFFF",o.fillRect(0,0,h,N),H=N-40,o.fillStyle="#2C3E50",this.roundRect(o,24,24,f,H,24),o.fill(),o.fillStyle="#FDFDFD",o.strokeStyle="#2C3E50",o.lineWidth=4,this.roundRect(o,20,20,f,H,24),o.fill(),o.stroke(),l.drawReportLabel(o,h,"行测小助理 \xb7 答题报告","details"===e?{centered:!0}:{}),(J=20+f-30,o.fillStyle="#2C3E50",o.beginPath(),o.arc(J,40,5,0,2*Math.PI),o.fill(),o.beginPath(),o.arc(J+12,40,5,0,2*Math.PI),o.fill(),o.beginPath(),o.arc(J+12,52,5,0,2*Math.PI),o.fill(),W=70,z=h/2,"details"===e)?(o.save(),o.beginPath(),o.arc(67,77,27,0,2*Math.PI),o.fillStyle="#FFFFFF",o.fill(),o.clip(),u?o.drawImage(u,40,50,54,54):(o.fillStyle="#BDC3C7",o.fillRect(40,50,54,54)),o.restore(),o.beginPath(),o.arc(67,77,27,0,2*Math.PI),o.strokeStyle="#2C3E50",o.lineWidth=2,o.stroke(),Y=110,V=50,o.textAlign="left",o.textBaseline="top",o.fillStyle="#2C3E50",o.font="bold 16px sans-serif",G=(null==(K=this.data.currentUserProfile)?void 0:K.nickname)||"考生",o.fillText(G,Y,V),X=o.measureText(G).width,o.fillStyle="#95A5A6",o.font="12px sans-serif",Z=this.formatDate(Date.now()).split(" ")[0],o.fillText(Z,Y+X+10,V+3),V+=24,$=this.data.mainTitle||this.data.examTitle||"考试结果",tt=this.data.subTitle,o.fillStyle="#2C3E50",o.font="900 18px sans-serif",o.fillText($,Y,V),tt&&(V+=22,o.fillStyle="#7F8C8D",o.font="bold 13px sans-serif",o.fillText(tt,Y,V)),ta=(te=20+f-30)-210,ts=te-55,tr=65,o.textBaseline="top",tn=String(this.data.score||0),o.font="900 48px sans-serif",ti=o.measureText(tn).width,o.font="bold 16px sans-serif",to=ta-(ti+8+o.measureText("分").width)/2,o.fillStyle="#2C3E50",o.textAlign="left",o.font="900 48px sans-serif",o.fillText(tn,to,tr),o.font="bold 16px sans-serif",o.fillText("分",to+ti+8,tr+20),tl=this.data.correctCount||0,tc=this.data.wrongCount||0,td=this.data.unansweredCount||0,o.textAlign="right",o.textBaseline="top",tu=te,tu=(th=function(t,e,a,s){o.fillStyle="#95A5A6",o.font="12px sans-serif",o.fillText(t,s,50);var r=o.measureText(t).width;return o.fillStyle=a,o.font="bold 16px sans-serif",o.fillText(e,s-r-4,48),s-r-o.measureText(e).width-15})("未答",td,"#95A5A6",tu),tu=th("错",tc,"#E74C3C",tu),tu=th("对",tl,"#27AE60",tu),this.data.percent&&(tf="超越 ".concat(this.data.percent,"% 对手"),tg="",this.data.rank&&this.data.totalSubmissions&&(tg="排名: ".concat(this.data.rank," / ").concat(this.data.totalSubmissions)),tm=this.data.rank>=1e5||this.data.totalSubmissions>=1e5?134:122,tx=tg?36:22,tp=ts-tm/2,tb=75,o.fillStyle="rgba(230, 126, 34, 0.1)",this.roundRect(o,tp,tb,tm,tx,10),o.fill(),o.textAlign="center",o.textBaseline="middle",tS=tp+tm/2,tv=tb+tx/2,tg?(o.font="bold 10px sans-serif",o.fillStyle="#E67E22",o.fillText(tf,tS,tv-8),o.font="bold 9px sans-serif",o.fillStyle="#95A5A6",o.fillText(tg,tS,tv+8)):(o.font="bold 10px sans-serif",o.fillStyle="#E67E22",o.fillText(tf,tS,tv))),W=160):(ty=88,t_=W,o.save(),o.beginPath(),o.arc(58,t_+18,18,0,2*Math.PI),o.fillStyle="#FFFFFF",o.fill(),o.clip(),u?(tC=u.width,tT=u.height,tC&&tT?(tA=Math.min(tC,tT),tk=(tC-tA)/2,tD=(tT-tA)/2,o.drawImage(u,tk,tD,tA,tA,40,t_,36,36)):o.drawImage(u,40,t_,36,36)):(o.fillStyle="#BDC3C7",o.fillRect(40,t_,36,36)),o.restore(),o.beginPath(),o.arc(58,t_+18,18,0,2*Math.PI),o.strokeStyle="#2C3E50",o.lineWidth=2,o.stroke(),o.fillStyle="#2C3E50",o.textAlign="left",o.textBaseline="top",o.font="bold 14px sans-serif",tE=(null==(tw=this.data.currentUserProfile)?void 0:tw.nickname)||"考生",o.fillText(tE,ty,t_),o.fillStyle="#95A5A6",o.font="11px sans-serif",tI=this.formatDate(Date.now()),o.fillText("提交于 ".concat(tI),ty,t_+18),W+=40,o.textAlign="center",o.textBaseline="top",tR=this.data.mainTitle||this.data.examTitle||"考试结果",tF=this.data.subTitle,o.font="800 15px sans-serif",tL=o.measureText(tR).width,tU=0,tF&&(o.font="bold 10px sans-serif",tU=o.measureText(tF).width),tM=Math.min(Math.max(tL,tU)+60,f-40),tP=tF?53:36,tq=z-tM/2,o.fillStyle="#F0F3F4",this.roundRect(o,tq,W,tM,tP,20),o.fill(),tB=W+6,o.fillStyle="#2C3E50",o.font="800 15px sans-serif",o.fillText(tR,z,tB),tF&&(o.font="bold 10px sans-serif",o.fillStyle="#555555",o.fillText(tF,z,tB+24+1)),W+=tP+p,tj=this.data.rank>=1e5||this.data.totalSubmissions>=1e5?164:152,tN=tO=x,tQ=(375-(tj+20+140))/2,tH=W,o.fillStyle="#2C3E50",this.roundRect(o,tQ+4,tH+4,tj,tO,24),o.fill(),o.fillStyle="#FFD3B6",o.strokeStyle="#2C3E50",o.lineWidth=4,this.roundRect(o,tQ,tH,tj,tO,24),o.fill(),o.stroke(),tJ=tQ+tj/2,o.fillStyle="#2C3E50",o.font="900 50px sans-serif",o.textAlign="center",o.textBaseline="middle",o.fillText(this.data.score,tJ,tH+38),o.font="bold 10px sans-serif",o.fillText("分",tJ,tH+67),this.data.percent&&(tW="超越 ".concat(this.data.percent,"% 对手"),tz="",this.data.rank&&this.data.totalSubmissions&&(tz="排名: ".concat(this.data.rank," / ").concat(this.data.totalSubmissions)),tK=tj-24,tY=tz?40:24,tV=tJ-tK/2,tG=tH+tO-tY-10,o.fillStyle="rgba(255, 255, 255, 0.55)",this.roundRect(o,tV,tG,tK,tY,12),o.fill(),o.textAlign="center",o.textBaseline="middle",tX=tG+tY/2,tz?(o.font="bold 11px sans-serif",o.fillStyle="#2C3E50",o.fillText(tW,tJ,tX-8),o.font="bold 10px sans-serif",o.fillStyle="#555555",o.fillText(tz,tJ,tX+8)):(o.font="bold 11px sans-serif",o.fillStyle="#2C3E50",o.fillText(tW,tJ,tX))),tZ=tQ+tj+20,t$=tH,o.fillStyle="#2C3E50",this.roundRect(o,tZ+4,t$+4,140,tN,24),o.fill(),o.fillStyle="#FFFFFF",o.strokeStyle="#2C3E50",o.lineWidth=4,this.roundRect(o,tZ,t$,140,tN,24),o.fill(),o.stroke(),t0=(tN-30)/3,t2=t$+15,(t1=function(t,e,a,s){o.fillStyle=a,o.font="900 20px sans-serif",o.textAlign="right",o.textBaseline="middle";var r=tZ+70;o.fillText(e,r-8,s),o.fillStyle="#7F8C8D",o.font="bold 12px sans-serif",o.textAlign="left",o.fillText(t,r+8,s+2)})("正确",this.data.correctCount,"#27AE60",t2+.5*t0),t1("错误",this.data.wrongCount,"#E74C3C",t2+1.5*t0),t1("未做",this.data.unansweredCount,"#2C3E50",t2+2.5*t0),W+=tO+b),t5=W,"details"===e)for(t8=.75*(t3=((t4=(f-40-40)/3)-32)/5)+26,t6=function(e,a,s,r){o.strokeStyle="#BDC3C7",o.lineWidth=1,t.roundRect(o,a-10,s-10,t4+20,r+20,8),o.stroke(),o.fillStyle="#2C3E50",o.textAlign="left",o.textBaseline="top",o.font="bold 16px sans-serif";var n=e.name;n.length>8&&(n=n.substring(0,8)+".."),o.fillText(n,a,s);var i=e.rate||"0.0",l="".concat(i,"%"),c="".concat(e.correct,"/").concat(e.count);o.textAlign="right",o.textBaseline="top",o.fillStyle="#27AE60",o.font="bold 16px sans-serif",o.fillText(l,a+t4-5,s);var d=o.measureText(l).width;o.fillStyle="#95A5A6",o.font="12px sans-serif",o.fillText(c,a+t4-5-d-8,s+3);var u=s+45,h=0;e.questions.forEach(function(e){var s=a+h*(t3+8),r=t.data.questionStats&&t.data.questionStats["q_".concat(e.num)],n="--";if(r){var i=Number(r.count||0),l=r.dist||{},c=String(e.cAns||"").trim().toUpperCase();i>0&&c&&void 0!==l[c]?n="".concat(l[c],"%"):i>0&&void 0!==r.acc&&(n="".concat(r.acc,"%"))}var d="#FFF8E1";"correct"===e.status&&(d="#E8F5E9"),"wrong"===e.status&&(d="#FFEBEE"),o.fillStyle="rgba(0,0,0,0.1)",t.roundRect(o,s+2,u+2,t3,t8,4),o.fill(),o.fillStyle=d,o.strokeStyle="#BDC3C7",o.lineWidth=1,t.roundRect(o,s,u,t3,t8,4),o.fill(),o.stroke(),o.fillStyle="#555555",o.textAlign="left",o.textBaseline="top",o.font="bold 10px sans-serif",o.fillText(e.num,s+5,u+3);var f=e.cAns;f||"correct"!==e.status||(f=e.uAns),f||(f="?");var g=u+17,m=u+t8-9,x=m-g-4,p=g+x/2;if("wrong"===e.status){var b=p-2;o.fillStyle="#E74C3C",o.font="900 14px sans-serif",o.textAlign="center",o.textBaseline="middle",o.fillText(e.uAns||"?",s+t3/2,b-8),o.font="bold 12px sans-serif",o.fillText("\xd7",s+t3/2+10,b-8),o.fillStyle="#27AE60",o.font="900 14px sans-serif",o.textBaseline="middle",o.fillText(f,s+t3/2,b+8),o.font="bold 12px sans-serif",o.fillText("√",s+t3/2+10,b+8)}else o.fillStyle="#2C3E50",o.font="900 20px sans-serif",o.textAlign="center",o.textBaseline="middle",o.fillText(f,s+t3/2,p-2);o.textBaseline="middle",o.textAlign="center",o.fillStyle="#27AE60",o.font="700 13px sans-serif",o.fillText(n,s+t3/2,m),++h>=5&&(h=0,u+=t8+8)})},t7=0;t7<v.length;t7+=3)t9=v[t7],et=v[t7+1],ee=v[t7+2],ea=45+Math.ceil(t9.questions.length/5)*(t8+8)+10,es=0,et&&(es=45+Math.ceil(et.questions.length/5)*(t8+8)+10),er=0,ee&&(er=45+Math.ceil(ee.questions.length/5)*(t8+8)+10),t6(t9,40,t5,ea),et&&t6(et,40+t4+20,t5,es),ee&&t6(ee,40+(t4+20)*2,t5,er),t5+=Math.max(ea,es,er)+40;else"long"===e?(ei=((en=(f-40-20)/2)-16)/5,eo=W,el=W,v.forEach(function(e,a){var s=a<S,r=s?eo:el,n=s?40:40+en+20;s&&a>0&&(r+=25),!s&&a>S&&(r+=25),o.fillStyle="#2C3E50",o.textAlign="left",o.textBaseline="middle",o.font="900 15px sans-serif",o.fillText(e.name,n,r);var i="".concat(e.correct,"/").concat(e.count);o.font="bold 12px sans-serif";var l=o.measureText(i).width+16,c=n+en-l;o.fillStyle="#ECF0F1",t.roundRect(o,c,r-11,l,22,6),o.fill(),o.fillStyle="#2C3E50",o.textAlign="center",o.fillText(i,c+l/2,r),r+=18;var d=0;e.questions.forEach(function(e){var a=n+d*(ei+4),s="#FCF3CF";"correct"===e.status&&(s="#D5F5E3"),"wrong"===e.status&&(s="#FADBD8"),o.fillStyle="rgba(0,0,0,0.1)",t.roundRect(o,a+2,r+2,ei,ei,8),o.fill(),o.fillStyle=s,o.strokeStyle="#2C3E50",o.lineWidth=1.5,t.roundRect(o,a,r,ei,ei,8),o.fill(),o.stroke(),o.fillStyle="#2C3E50",o.textAlign="center",o.textBaseline="middle",o.font="bold 12px sans-serif",o.fillText(e.num,a+ei/2,r+ei/2),++d>=5&&(d=0,r+=ei+4)}),d>0&&(r+=ei+4),r+=5,s?eo=r:el=r})):(ec=(f-40-20)/3,v.forEach(function(e,a){var s=Math.floor(a/3),r=40+a%3*(ec+10),n=t5+80*s;o.fillStyle="#2C3E50",t.roundRect(o,r+2,n+2,ec,70,10),o.fill(),o.fillStyle="white",o.strokeStyle="#2C3E50",o.lineWidth=2,t.roundRect(o,r,n,ec,70,10),o.fill(),o.stroke(),o.fillStyle="#2C3E50",o.textAlign="left",o.textBaseline="top",e.name.length>4?o.font="900 10px sans-serif":o.font="900 14px sans-serif",o.fillText(e.name,r+8,n+15);var i=Math.round(e.correct/e.count*100),l="".concat(i,"%"),c="".concat(e.correct,"/").concat(e.count);o.fillStyle="#27AE60",o.font="bold 16px sans-serif",o.fillText(l,r+10,n+45),o.fillStyle="#95A5A6",o.font="10px sans-serif",o.measureText(l).width,o.textAlign="right",o.fillText(c,r+ec-10,n+48)}),ed=Math.ceil(v.length/3),t5+=80*ed);return s.check(),[4,l.exportCanvas(i,s)];case 4:if(eu=r.sent(),s.release(),s.check(),!eu||!eu.tempFilePath)throw Error("图片生成失败，请重试");return wx.hideLoading(),[4,l.saveToAlbum(eu.tempFilePath,s)];case 5:return eh=r.sent(),s.check(),eh&&wx.showToast({title:"已保存到相册",icon:"success"}),c.record(eh?"image.saved":"image.cancelled",{mode:e}),[3,8];case 6:return(ef=r.sent()).cancelled||this._unloaded||(c.record("image.failed",{mode:e,code:ef.errCode,message:ef.errMsg||ef.message}),wx.hideLoading(),wx.showToast({title:"saving"===s.phase?"相册保存失败，请检查权限及手机空间":"图片生成失败，请重试",icon:"none"})),[3,8];case 7:return s.release(),this._imageJob===s&&(this._imageJob=null,this._unloaded||wx.hideLoading()),[7];case 8:return[2]}})}).call(this)},copyDiagnostics:function(){c.copy()},onHide:function(){this._imageJob&&"saving"!==this._imageJob.phase&&(this._imageJob.cancel(),wx.hideLoading())},onUnload:function(){this._unloaded=!0,this._imageJob&&(this._imageJob.cancel(),wx.hideLoading()),this._resultData=null},onMemoryPressure:function(){this._imageJob&&"saving"!==this._imageJob.phase&&this._imageJob.cancel()},roundRect:function(t,e,a,s,r,n){s<2*n&&(n=s/2),r<2*n&&(n=r/2),t.beginPath(),t.moveTo(e+n,a),t.arcTo(e+s,a,e+s,a+r,n),t.arcTo(e+s,a+r,e,a+r,n),t.arcTo(e,a+r,e,a,n),t.arcTo(e,a,e+s,a,n),t.closePath()},onLoad:function(e){return t._(function(){var a,s,n,l,c,u,m,x,p,b,v,C,T,k,I,R,L,U,M,P,q,B,j,O,N,Q;return r._(this,function(H){switch(H.label){case 0:if(a=this,S())return[2];if(this._unloaded=!1,s=this.setData.bind(this),this.setData=function(t,e){a._unloaded||s(t,e)},n=e.mainTitle?decodeURIComponent(e.mainTitle):"",l=e.subTitle?decodeURIComponent(e.subTitle):"",n&&this.setData({mainTitle:n,subTitle:l}),!(c=i.get()))return wx.navigateBack(),[2];if(this._resultData=c,u=this.data.mainTitle||c.mainTitle||"",m=this.data.subTitle||c.subTitle||"",!u&&c.title&&((x=c.title.indexOf(" "))>0?(u=c.title.substring(0,x),m=c.title.substring(x+1)):u=c.title),u||(u="考试结果"),this.setData({examTitle:c.title,mainTitle:u,subTitle:m,percent:null,rank:null,totalSubmissions:null,examId:c.examId,scoreFilterOptions:F(c.examId,null)}),!(!h(c)&&c._id))return[3,4];H.label=1;case 1:return H.trys.push([1,3,,4]),[4,o.load(c,function(e){return t._(function(){return r._(this,function(t){switch(t.label){case 0:return[4,wx.cloud.database().collection("exam_history").doc(e).get()];case 1:return[2,t.sent().data]}})})()})];case 2:return(p=H.sent())&&Object.assign(c,p),[3,4];case 3:return console.error("Failed to refetch record",H.sent()),[3,4];case 4:if(this._unloaded)return[2];h(c)&&(b=w(c.examStructure||d.getExamStructure(c.examId)),null!==(v=f(c,c.correctAnswers,b.reduce(function(t,e){return t+e.count},0)))&&(c.userAnswers=v,i.update(c),o.remember(c))),C=w(c.examStructure||d.getExamStructure(c.examId)),T=g(c.correctAnswers,C.reduce(function(t,e){return t+e.count},0)),k=0,I=!0,R=!0,L=!1,U=void 0;try{for(M=C[Symbol.iterator]();!(R=(P=M.next()).done);R=!0)for(q=P.value,B=0;B<q.count;B++)k++,q.scored&&!T["q_".concat(k)]&&(I=!1)}catch(t){L=!0,U=t}finally{try{R||null==M.return||M.return()}finally{if(L)throw U}}if(j=null,!(!I&&c.examId&&h(c)))return[3,8];H.label=5;case 5:return H.trys.push([5,7,,8]),[4,D(c.examId)];case 6:return(O=H.sent())&&(O.sections&&Array.isArray(O.sections)?(N=w(O.sections),c.examStructure&&_(c.examStructure)!==_(N)?j=null:(j=y(O.sections),c.examStructure||(c.examStructure=N))):O.answers&&(j={},("string"==typeof O.answers?O.answers.split(""):O.answers).forEach(function(t,e){j["q_".concat(e+1)]=t})),console.log("Result Page: Loaded latest answers from Cloud/CDN",Object.keys(j||{}).length)),[3,8];case 7:return console.warn("Result Page: Failed to fetch latest cloud answers",H.sent()),[3,8];case 8:if(this._unloaded)return[2];return j&&Object.keys(j).length>0&&(c.correctAnswers=j),this.calculateScore(c,j),(Q=wx.getStorageSync("preload_leaderboard"))&&Q.examId===c.examId&&Array.isArray(Q.list)&&Q.list.length>0&&Q.list.every(function(t){return t._id&&t.examStructure&&void 0!==t.answerDetailsAvailable})&&Date.now()>=Q.timestamp&&Date.now()-Q.timestamp<18e5&&(console.log("Using preloaded leaderboard"),this.setData({leaderboardList:Q.list})),c.examId&&(this.calculateRankPercent(c._openid,c.examId,this.data.score,!0),A().catch(function(){return""}).then(function(t){a._unloaded||(a.setData({currentUserOpenId:t}),a.loadLeaderboard(c.examId,a.data.score),t&&E().then(function(t){!a._unloaded&&t&&a.handleProfileUpdate(t)}))})),[2]}})}).call(this)},retryHistorySave:function(){this._savingHistory||!this._pendingHistoryResult||this.data.historySaved||this.calculateScore(this._pendingHistoryResult)},onShow:function(){var t=this;if(p){var e=getApp();if(e.globalData&&e.globalData.userInfo){var r=e.globalData.userInfo.profile;if(r){var n=s._(a._({},r),{nickName:r.nickname||r.nickName,avatarUrl:r.avatar||r.avatarUrl});if(this.setData({currentUserProfile:n}),this.data.leaderboardList&&this.data.leaderboardList.length>0){var o=this.data.leaderboardList.map(function(t){var r=e.globalData.userInfo.openid&&t._openid===e.globalData.userInfo.openid;return t.isMe||r?s._(a._({},t),{avatarUrl:n.avatarUrl||n.avatar,nickName:n.nickName}):t});this.setData({leaderboardList:o})}}}else this.data.currentUserOpenId&&E().then(function(e){e&&t.setData({currentUserProfile:e})});if(!this.data.examId){var l=i.get();l&&l.examId&&this.setData({examId:l.examId})}this.data.isAdvancedMode&&!this.data.questionStats&&this.loadQuestionStats()}},loadLeaderboard:function(e){var n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null,i=arguments.length>2&&void 0!==arguments[2]&&arguments[2];return t._(function(){var t,o,l,c,d;return r._(this,function(r){switch(r.label){case 0:if(t=Date.now(),this._leaderboardPending||!i&&this._lastLeaderboardLoadTime&&t-this._lastLeaderboardLoadTime<500)return console.log("[Result] Skipping duplicate leaderboard load for ".concat(e," (throttled)")),[2];this._lastLeaderboardLoadTime=t,this._leaderboardPending=!0,this.setData({leaderboardLoading:!0,leaderboardLoadError:!1}),console.log("Loading leaderboard for:",e),o=null!==n?n:this.data.score,l=s._(a._({},this._resultData),{examId:e,score:o,timestamp:this._resultData&&this._resultData.timestamp||Date.now(),correctCount:this.data.correctCount,totalQuestions:this.data.totalQuestions,forceUpdate:!0}),r.label=1;case 1:return r.trys.push([1,3,4,5]),[4,(0,require("../../utils/leaderboard-helper.js").fetchLeaderboardData)(e,this.data.currentUserOpenId,this.data.currentUserProfile,!0,i,l)];case 2:return(c=r.sent())&&(d=this.data.currentUserProfile,this.setData({leaderboardList:d?c.leaderboardList.map(function(t){return t.isMe?s._(a._({},t),{nickName:d.nickName||d.nickname||t.nickName,avatarUrl:d.avatarUrl||d.avatar||t.avatarUrl}):t}):c.leaderboardList})),[3,5];case 3:return console.error("Load leaderboard failed",r.sent()),this.setData({leaderboardLoadError:!0}),[3,5];case 4:return this._leaderboardPending=!1,this.setData({leaderboardLoading:!1}),[7];case 5:return[2]}})}).call(this)},formatDate:function(t){if(!t)return"";var e=new Date(t);return"".concat(e.getFullYear(),"/").concat(e.getMonth()+1,"/").concat(e.getDate()," ").concat(e.getHours().toString().padStart(2,"0"),":").concat(e.getMinutes().toString().padStart(2,"0"))},handleProfileUpdate:function(t){var e=this;console.log("Result Page: Received profile update via broadcast",t);var r=s._(a._({},t),{nickName:t.nickname||t.nickName,avatarUrl:t.avatar||t.avatarUrl});if(this.setData({currentUserProfile:a._({},this.data.currentUserProfile,r)}),this.data.leaderboardList&&this.data.leaderboardList.length>0){var n=this.data.leaderboardList.map(function(t){var n=e.data.currentUserOpenId&&t._openid===e.data.currentUserOpenId,i=r.userId&&(t.userId===r.userId||t._openid===r.userId);return t.isMe||n||i?s._(a._({},t),{nickName:r.nickName,avatarUrl:r.avatarUrl||r.avatar,userAnswers:t.userAnswers,totalQuestions:t.totalQuestions,correctCount:t.correctCount,examId:t.examId}):t});this.setData({leaderboardList:n})}},onProfileUpdate:function(t){var e=t.detail;this.handleProfileUpdate(e)},calculateRankPercent:function(e,a,s){arguments.length>3&&void 0!==arguments[3]&&arguments[3];var n=arguments.length>4&&void 0!==arguments[4]&&arguments[4];return t._(function(){var t;return r._(this,function(r){switch(r.label){case 0:if(!a||void 0===s||this._rankPending)return[2];this._rankPending=!0,r.label=1;case 1:return r.trys.push([1,3,4,5]),[4,k(a,n)];case 2:if(t=r.sent(),this._unloaded||(this.setData({rankLoadError:!t}),!t))return[2];return this.applyRankSnapshot(t,s,e),[3,5];case 3:return r.sent(),this.setData({rankLoadError:!0}),[3,5];case 4:return this._rankPending=!1,[7];case 5:return[2]}})}).call(this)},retryRankingLoad:function(){var t=Date.now();if(!this._rankPending&&!this._leaderboardPending){if(this._lastRankingRetry&&t-this._lastRankingRetry<15e3)return void wx.showToast({title:"请稍后再试",icon:"none"});this._lastRankingRetry=t,(this.data.leaderboardLoadError||!this.data.leaderboardList.length)&&this.loadLeaderboard(this.data.examId,null,!0),(this.data.rankLoadError||!this.data.hasCalculatedRank)&&this.calculateRankPercent(this.data.currentUserOpenId,this.data.examId,this.data.score,!0,!0)}},applyRankSnapshot:function(t,e,a){var s=C(t,e),r=s||{rank:null,percent:null,totalSubmissions:null};if(r.hasCalculatedRank=!!s,r.rankLoadError=!t,t){var n=t.filteredQuestionStats||{},i=n["0"]||t.questionStats||null;r.filteredQuestionStats=n,r.fullQuestionStats=i,r.questionStats=n[String(this.data.currentScoreFilter||0)]||i,r.scoreFilterOptions=F(this.data.examId,n),r.rawStats=t.rawStats||[]}this.setData(r),s&&this.updateLocalCache(this.data.examId,Number(e),a,s.percent,s.rank,s.totalSubmissions)},updateLocalCache:function(t,e,r,o,l,c){try{var d=getApp(),u="leaderboard_cache_".concat(t),h=d.globalData.leaderboardCache?d.globalData.leaderboardCache[t]:null;h||(h=wx.getStorageSync(u)),h&&h.historyList&&(h.historyList=h.historyList.map(function(t){return t.score!==e||t._openid!==r&&t._openid?t:s._(a._({},t),{percent:o,rank:l})}),d.globalData.leaderboardCache&&(d.globalData.leaderboardCache[t]=h),n.write(u,h))}catch(t){console.error("Failed to update leaderboard cache",t)}try{var f=i.get();i.same(f,this._resultData)&&(f.percent=o,f.rank=l,f.totalSubmissions=c,i.update(f))}catch(t){console.error("Failed to update storage percent",t)}},showUnavailableHistory:function(t){this.setData({detailsUnavailable:!0,historySaved:!!t._id,saveStatus:"",score:Number(t.score||0).toFixed(1),correctCount:void 0===t.correctCount?"—":t.correctCount,wrongCount:void 0===t.wrongCount?"—":t.wrongCount,unansweredCount:void 0===t.unansweredCount?"—":t.unansweredCount,totalQuestions:t.totalQuestions||0,sectionResults:[]})},calculateScore:function(t){var e=this,s=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;this._resultData=t;var r=t.examId,n=t.title,l=t.timestamp;if(t._id&&!h(t))return void this.showUnavailableHistory(t);var c=w(t.examStructure||d.getExamStructure(r)).reduce(function(t,e){return t+e.count},0),u=f(t,s||d.getCorrectAnswers(r),c);if(null===u)return void this.showUnavailableHistory(t);this.setData({detailsUnavailable:!1});var x={};s&&Object.keys(s).length>0?console.log("Using forced answers from cloud/CDN",Object.keys(x=s).length):t.correctAnswers&&Object.keys(t.correctAnswers).length>0?console.log("Using history/record answers",Object.keys(x=g(t.correctAnswers,c)).length):r&&(d.getCorrectAnswers?x=d.getCorrectAnswers(r):d.correctAnswers&&(x=d.correctAnswers[r]));var p=0,S=0,v=0,y=0,_=[],C=1,T=w(t.examStructure||(d.getExamStructure?d.getExamStructure(r):d.examStructure||R));if((!x||0===Object.keys(x).length)&&r&&d.getCorrectAnswers){var A=d.getCorrectAnswers(r);A&&Object.keys(A).length>0&&(t.correctAnswers=A)}var k=x||{};T.forEach(function(t){for(var e=0,a=[],s=!1===t.scored||"sec_extra"===t.id||t.name.includes("不计分")||t.name.includes("附加题"),r=0;r<t.count;r++){var n="q_".concat(C),i=u?u[n]:void 0,o=k[n],l="unanswered";i?o?i===o?(l="correct",e++,!s&&p++):(l="wrong",!s&&S++):l="unknown":!s&&v++,a.push({qId:n,num:C,uAns:i||"-",cAns:o,status:l}),C++}var c=t.count>0?(e/t.count*100).toFixed(1):"0.0";_.push({name:t.name,count:t.count,correct:e,questions:a,rate:c}),s||(y+=t.count)});var D=String(r||"").startsWith("26-huasheng-shiye-A")?(1.5*p).toFixed(1):(y?p/y*100:0).toFixed(1),E={};if(this.data.isAdvancedMode&&_.forEach(function(t,e){E[t.name]=0!==e}),this.setData({score:D,correctCount:p,wrongCount:S,unansweredCount:v,totalQuestions:y,sectionResults:_,sectionCollapsed:E}),t._id||this.data.historySaved||this._savingHistory)console.log("Skipping save: Already saved or viewing history record");else{if(this._savingHistory=!0,this._pendingHistoryResult=t,this.setData({saveStatus:"saving"}),b)F={userAnswers:m(u,c),correctAnswers:m(k,c)};else{var F,L={},U=[];Object.keys(k).forEach(function(t){var e=u[t];e?e!==k[t]&&(L[t]=e):U.push(Number(t.slice(2)))}),F={userWrongAnswers:L,unansweredQuestions:U,correctAnswers:k}}I(a._({examId:r,title:n,score:D,correctCount:p,totalQuestions:y,timestamp:l,examStructure:T},F)).then(function(a){if(!a||!a._id)throw Error("Missing saved record ID");e.setData({historySaved:!0,saveStatus:"saved"}),a._id&&(t._id=a._id,i.update(t),o.remember(t))}).catch(function(t){console.error("Save failed",t),e.setData({historySaved:!1,saveStatus:"error"})}).finally(function(){e._savingHistory=!1})}},onHomeTap:function(){wx.reLaunch({url:"/pages/index/index"})},onShareAppMessage:function(){var t=i.get()||{},e=t.title,a=t.examId,s=t.mainTitle,r=t.subTitle,n=this.data.score;return{title:"我在《".concat(e,"》中获得了").concat(n,"分，快来挑战我吧！"),path:"/pages/exam/exam?examId=".concat(a,"&title=").concat(encodeURIComponent(e),"&mainTitle=").concat(encodeURIComponent(s||""),"&subTitle=").concat(encodeURIComponent(r||""))}},onShareTimeline:function(){var t=i.get()||{},e=t.title,a=t.examId,s=t.mainTitle,r=t.subTitle,n=this.data.score;return{title:"我在《".concat(e,"》中获得了").concat(n,"分，快来挑战我吧！"),query:"examId=".concat(a,"&title=").concat(encodeURIComponent(e),"&mainTitle=").concat(encodeURIComponent(s||""),"&subTitle=").concat(encodeURIComponent(r||""))}}}); 
 			}); 	require("pages/result/result.js");
 		__wxRoute = 'pages/set-history/set-history';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/set-history/set-history.js';	define("pages/set-history/set-history.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../@swc/runtime/_async_to_generator"),e=require("../../@swc/runtime/_object_spread"),a=require("../../@swc/runtime/_object_spread_props"),r=require("../../@swc/runtime/_sliced_to_array"),i=require("../../@swc/runtime/_ts_generator"),s=require("../../utils/local-cache.js"),n=require("../../utils/result-session.js"),o=require("../../utils/history-detail.js"),l=require("../../utils/runtime-diagnostics.js"),d=require("../../utils/cloud.js"),u=d.getExamHistory,h=d.deleteExamRecord,c=d.filterDeletedHistory,f=d.fetchExamRankStats,g=require("../../utils/stats-snapshot.js").rankFromSnapshot,b=require("../../utils/event-bus.js");require("../../utils/answer-compat.js").hasAnswerPayload;var _=require("../../utils/feature-flags.js"),p=_.QUESTION_BANK_ENABLED,m=_.redirectIfQuestionBankClosed;Page({data:{title:"答题记录",examId:"",historyList:[],loading:!0,leaderboardList:[],leaderboardLoading:!1,leaderboardLoadError:!1,currentUserOpenId:"",currentUserProfile:null,fullRankList:[],totalExamCount:0,historyOffset:0,hasMoreHistory:!0,loadingMore:!1,deletingRecordId:"",deleteError:""},onLoad:function(t){var e=this;if(!m()){this._unloaded=!1;var a=this.setData.bind(this);this.setData=function(t,r){e._unloaded||a(t,r)},this.boundProfileUpdate=this.handleProfileUpdate.bind(this),b.on("user_profile_updated",this.boundProfileUpdate);var r=getApp();if(r.globalData.historyTapTime){var i=Date.now();console.log("[Perf Debug] 2. Target Page onLoad:",i,"Total Latency (Touch->Load):",i-r.globalData.historyTapTime,"ms")}var s=t.mainTitle?decodeURIComponent(t.mainTitle):"",n=t.subTitle?decodeURIComponent(t.subTitle):"",o=t.title?decodeURIComponent(t.title):"";if(o&&this.setData({title:o}),o&&!s){var l=o.indexOf(" ");l>0?(s=o.substring(0,l),n=o.substring(l+1)):s=o}this.setData({mainTitle:s||"考试历史",subTitle:n}),t.examId&&(this.setData({examId:t.examId}),setTimeout(function(){e._unloaded||e.initPageData().catch(function(t){return console.warn(t)})},30))}},onUnload:function(){this._unloaded=!0,this._openingRecord&&wx.hideLoading(),this.boundProfileUpdate&&b.off("user_profile_updated",this.boundProfileUpdate)},onShow:function(){var t=this;if(p){var r=getApp();if(r.globalData&&r.globalData.userInfo){var i=r.globalData.userInfo.profile;if(i){console.log("Syncing profile from global data in onShow");var s=a._(e._({},i),{nickName:i.nickname||i.nickName,avatarUrl:i.avatar||i.avatarUrl});if(this.setData({currentUserProfile:s}),this.data.leaderboardList&&this.data.leaderboardList.length>0){var n=this.patchLeaderboardList(this.data.leaderboardList,s);this.setData({leaderboardList:n})}}}try{this.data.examId&&wx.getStorageSync("history_needs_refresh")&&(wx.removeStorageSync("history_needs_refresh"),this.fetchHistoryList(!0).then(function(e){t.setData({historyList:e,loading:!1}),t.loadRankingData()}).catch(function(){}))}catch(t){}var o=Date.now()-(this._leaderboardCacheTimestamp||0);this._pageDataReady&&!this._refreshingLeaderboard&&o>=216e5&&(this._refreshingLeaderboard=!0,this.initPageData(!1).finally(function(){t._refreshingLeaderboard=!1}))}},initPageData:function(){var r=arguments.length>0&&void 0!==arguments[0]&&arguments[0];return t._(function(){var t,s,n,o,l,d,u,h,c,g,b,_,p,m;return i._(this,function(i){switch(i.label){case 0:t=getApp(),this.data.examId,s=null,t.globalData&&t.globalData.leaderboardCache&&t.globalData.leaderboardCache[this.data.examId]?(s=t.globalData.leaderboardCache[this.data.examId],console.log("Using global memory cache")):(n="leaderboard_cache_".concat(this.data.examId),(s=wx.getStorageSync(n))&&console.log("Using storage cache")),s?(this._leaderboardCacheTimestamp=s.timestamp||0,o=s.leaderboardList||[],t.globalData&&t.globalData.userInfo&&t.globalData.userInfo.profile&&(l=a._(e._({},t.globalData.userInfo.profile),{nickName:t.globalData.userInfo.profile.nickname||t.globalData.userInfo.profile.nickName,avatarUrl:t.globalData.userInfo.profile.avatar||t.globalData.userInfo.profile.avatarUrl}),o=this.patchLeaderboardList(o,l)),this._rawList=s.rawList||[],this.setData({historyList:this.visibleHistory(s.historyList),leaderboardList:o,fullRankList:s.fullRankList||[],totalExamCount:s.totalExamCount||0,hasMoreHistory:(s.historyList||[]).length>=20,historyOffset:20*((s.historyList||[]).length>=20),loading:!1})):this.setData({loading:!0}),u=(d=require("../../utils/cloud.js")).getOpenId,h=d.getUserProfile,i.label=1;case 1:if(i.trys.push([1,6,,7]),!(t.globalData&&t.globalData.userInfo))return[3,2];return this.setData({currentUserOpenId:t.globalData.userInfo.openid,currentUserProfile:t.globalData.userInfo.profile}),[3,5];case 2:return[4,u()];case 3:return c=i.sent(),this.setData({currentUserOpenId:c}),[4,h()];case 4:(g=i.sent())&&(this.setData({currentUserProfile:g}),t.globalData||(t.globalData={}),t.globalData.userInfo={openid:c,profile:g}),i.label=5;case 5:return[3,7];case 6:return console.error("Failed to load user profile",i.sent()),[3,7];case 7:if(console.log("nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn"),console.log("fvvvvvv"),b=this.fetchHistoryList(r),_=f(this.data.examId,r).catch(function(){return null}),this._unloaded)return[2];p=[],i.label=8;case 8:return i.trys.push([8,10,,11]),[4,b];case 9:if(p=i.sent(),this._unloaded)return[2];return m=(this._lastRawCount||0)>=20,this.setData({historyList:this.visibleHistory(p),historyOffset:this._nextHistoryOffset||20,hasMoreHistory:m,loading:!1}),[3,11];case 10:return console.error("History load failed",i.sent()),this.data.historyList.length||this.setData({loading:!1}),[3,11];case 11:return[4,this.loadRankingData(r,_)];case 12:return i.sent(),this._pageDataReady=!0,[2]}})}).call(this)},loadRankingData:function(){var e=arguments.length>0&&void 0!==arguments[0]&&arguments[0],a=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;return t._(function(){var t,n,o,l,d,u,h,c,g,b,_,p,m;return i._(this,function(i){switch(i.label){case 0:if(this._rankingPending)return[2];t=getApp(),this._rankingPending=!0,this.setData({leaderboardLoading:!0,leaderboardLoadError:!1}),n=this.visibleHistory(this.data.historyList).filter(function(t){return null!==t.score&&void 0!==t.score&&Number.isFinite(Number(t.score))}).reduce(function(t,e){return!t||Number(e.score)>Number(t.score)?e:t},null),o=this.data.examId?this.fetchLeaderboardData(this.data.examId,e,n):Promise.resolve(null),l=a||f(this.data.examId,e).catch(function(){return null}),i.label=1;case 1:return i.trys.push([1,3,4,5]),[4,Promise.all([o,l])];case 2:if(u=(d=r._.apply(void 0,[i.sent(),2]))[0],h=d[1],this._unloaded)return[2];if(!u||!h)throw Error("Ranking snapshot unavailable");return this._rankSnapshot=h,c=[],g=[],b=[],_=0,p=this.data.historyList,u&&(c=u.leaderboardList,g=u.fullRankList,_=u.totalCount,this.data.currentUserProfile&&(c=this.patchLeaderboardList(c,this.data.currentUserProfile)),u.rawList&&(b=u.rawList),this._rawList=b||[]),h&&(_=Number(h.totalCount)||0),p=this.calculateHistoryRanks(p,g,b,_),p=this.visibleHistory(p),this.setData({historyList:p,leaderboardList:c,fullRankList:g,totalExamCount:_}),m={historyList:p,leaderboardList:c,fullRankList:[],rawList:[],totalExamCount:_,timestamp:u&&u.cacheTimestamp||Date.now()},this._leaderboardCacheTimestamp=m.timestamp,t.globalData||(t.globalData={}),t.globalData.leaderboardCache||(t.globalData.leaderboardCache={}),s.keepRecent(t.globalData.leaderboardCache,this.data.examId,m),s.write("leaderboard_cache_".concat(this.data.examId),m),[3,5];case 3:return console.warn("Leaderboard background load failed",i.sent()),this.setData({leaderboardLoadError:!0}),[3,5];case 4:return this._rankingPending=!1,this.setData({leaderboardLoading:!1}),[7];case 5:return[2]}})}).call(this)},retryRankingLoad:function(){if(!this._rankingPending){var t=Date.now();if(this._lastRankingRetry&&t-this._lastRankingRetry<15e3)return void wx.showToast({title:"请稍后再试",icon:"none"});this._lastRankingRetry=t,this.loadRankingData(!0)}},fetchHistoryList:function(){var r=arguments.length>0&&void 0!==arguments[0]&&arguments[0],s=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return t._(function(){var t,n,o,l,d;return i._(this,function(i){switch(i.label){case 0:return t=this,[4,u(r,n=s&&this.data.historyOffset||0,!0)];case 1:l=(o=i.sent()).filter(function(e){return!t.data.examId||e.examId===t.data.examId}),d=0,i.label=2;case 2:if(!(!s&&!l.length&&20===o.length&&d<4&&!this._unloaded))return[3,5];return[4,u(!1,n+=20,!0)];case 3:l=(o=i.sent()).filter(function(e){return!t.data.examId||e.examId===t.data.examId}),i.label=4;case 4:return d++,[3,2];case 5:return this._lastRawCount=o.length,this._nextHistoryOffset=n+o.length,[2,this.visibleHistory(l).map(function(t){var r=new Date(t.timestamp||t.createTime);return a._(e._({},t),{dateStr:r.getMonth()+1+"月"+r.getDate()+"日",timeStr:String(r.getHours()).padStart(2,"0")+":"+String(r.getMinutes()).padStart(2,"0")})})]}})}).call(this)},fetchLeaderboardData:function(e){var a=arguments.length>1&&void 0!==arguments[1]&&arguments[1],r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null;return t._(function(){return i._(this,function(t){switch(t.label){case 0:return[4,(0,require("../../utils/leaderboard-helper.js").fetchLeaderboardData)(e,this.data.currentUserOpenId,this.data.currentUserProfile,!0,a,r)];case 1:return[2,t.sent()]}})}).call(this)},onLoadMoreHistory:function(){return t._(function(){var t,e,a,r;return i._(this,function(i){switch(i.label){case 0:if(this.data.loadingMore||!this.data.hasMoreHistory)return[2];this.setData({loadingMore:!0}),i.label=1;case 1:return i.trys.push([1,3,,4]),[4,this.fetchHistoryList(!0,!0)];case 2:return t=i.sent(),e=this._lastRawCount||0,a=this._nextHistoryOffset,this.setData({historyOffset:a,hasMoreHistory:e>=20}),t&&t.length&&(r=this.calculateHistoryRanks(t,this.data.fullRankList||[],this._rawList||[],this.data.totalExamCount||0),this.setData({historyList:this.visibleHistory(this.data.historyList.concat(r)).filter(function(t,e,a){return a.findIndex(function(e){return e._id===t._id})===e})})),[3,4];case 3:return console.error("Load more failed",i.sent()),[3,4];case 4:return this.setData({loadingMore:!1}),[2]}})}).call(this)},calculateHistoryRanks:function(t,a,r,i){var s=this;return t.map(function(t){var a=g(s._rankSnapshot,t.score);return e._({},t,a||{rank:0,percent:null,totalSubmissions:null})})},onPullDownRefresh:function(){this.initPageData(!0).catch(function(t){return console.warn(t)}).finally(function(){wx.stopPullDownRefresh()})},onRecordTap:function(e){return t._(function(){var a,r,s;return i._(this,function(n){switch(n.label){case 0:if(this._deletingRecord||this._unloaded||this._openingRecord||!(a=this.data.historyList[Number(e.currentTarget.dataset.index)]))return[2];this._openingRecord=!0,wx.showLoading({title:"加载详情...",mask:!0}),n.label=1;case 1:return n.trys.push([1,4,5,6]),[4,o.load(a,function(e){return t._(function(){return i._(this,function(t){switch(t.label){case 0:return[4,wx.cloud.database().collection("exam_history").doc(e).get()];case 1:return[2,t.sent().data]}})})()})];case 2:if(r=n.sent(),this._unloaded||this._deletedRecordIds&&this._deletedRecordIds.has(a._id))return[2];return[4,this.navigateToResult(r)];case 3:return n.sent(),[3,6];case 4:return s=n.sent(),l.record("history.detail.failed",{code:s.errCode,message:s.errMsg||s.message}),this._unloaded||(wx.hideLoading(),wx.showToast({title:s.errMsg?"详情读取失败，请稍后重试":s.message||"详情读取失败，请重试",icon:"none"})),[3,6];case 5:return this._openingRecord=!1,this._unloaded||wx.hideLoading(),[7];case 6:return[2]}})}).call(this)},navigateToResult:function(t){n.set(t),this.data.leaderboardList&&this.data.leaderboardList.length&&s.write("preload_leaderboard",{examId:this.data.examId,list:this.data.leaderboardList,timestamp:this._leaderboardCacheTimestamp||0});var e=this.data.mainTitle||"",a=this.data.subTitle||"";return new Promise(function(t,r){return wx.navigateTo({url:"/pages/result/result?mainTitle="+encodeURIComponent(e)+"&subTitle="+encodeURIComponent(a),success:t,fail:r})})},copyDiagnostics:function(){l.copy()},visibleHistory:function(t){var e=this;return("function"==typeof c?c(t||[]):t||[]).filter(function(t){return!e._deletedRecordIds||!e._deletedRecordIds.has(t._id)})},onDeleteRecord:function(e){var a=this,r=e.currentTarget.dataset.id;!r||this._deletingRecord||this._unloaded||(this._deletingRecord=r,this.setData({deleteError:""}),wx.showModal({title:"删除记录",content:"确定要删除这条成绩吗？",success:function(e){return t._(function(){var t;return i._(this,function(a){switch(a.label){case 0:if(!(e.confirm&&!this._unloaded))return[3,6];this.setData({deletingRecordId:r}),wx.showLoading({title:"删除中"}),a.label=1;case 1:return a.trys.push([1,3,4,5]),[4,h(r,this.data.examId)];case 2:if(a.sent(),this._deletedRecordIds||(this._deletedRecordIds=new Set),this._deletedRecordIds.add(r),this._unloaded)return[2];return this.setData({historyList:this.visibleHistory(this.data.historyList)}),this.loadRankingData(),wx.showToast({title:"已删除",icon:"success"}),[3,5];case 3:return console.error(t=a.sent()),this._unloaded||(this.setData({deleteError:String(t&&(t.errMsg||t.message)||"删除失败，请重试").slice(0,200)}),wx.showToast({title:"删除失败，记录已保留",icon:"none"})),[3,5];case 4:return wx.hideLoading(),this._deletingRecord=null,this._unloaded||this.setData({deletingRecordId:""}),[7];case 5:return[3,7];case 6:this._deletingRecord=null,a.label=7;case 7:return[2]}})}).call(a)},fail:function(){a._deletingRecord=null}}))},patchLeaderboardList:function(t,r){if(!t||!t.length||!r)return t;var i=getApp(),s=this.data.currentUserOpenId||i.globalData.userInfo&&i.globalData.userInfo.openid;return t.map(function(t){var i=s&&t._openid===s,n=r.userId&&(t.userId===r.userId||t._openid===r.userId);return t.isMe||i||n?a._(e._({},t),{avatarUrl:r.avatarUrl||r.avatar,nickName:r.nickName||r.nickname}):t})},handleProfileUpdate:function(t){var r=a._(e._({},t),{nickName:t.nickname||t.nickName,avatarUrl:t.avatar||t.avatarUrl});if(this.setData({currentUserProfile:e._({},this.data.currentUserProfile,r)}),this.data.leaderboardList&&this.data.leaderboardList.length>0){var i=this.patchLeaderboardList(this.data.leaderboardList,r);this.setData({leaderboardList:i})}},onProfileUpdate:function(t){var e=t.detail;this.handleProfileUpdate(e)}}); 
 			}); 	require("pages/set-history/set-history.js");
 		__wxRoute = 'pages/timer-setup/timer-setup';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/timer-setup/timer-setup.js';	define("pages/timer-setup/timer-setup.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_define_property"),t=require("../../@swc/runtime/_object_spread"),a=require("../../@swc/runtime/_object_spread_props"),i=require("../../@swc/runtime/_sliced_to_array"),n=require("../../@swc/runtime/_to_consumable_array"),o=require("../../utils/timer-records.js").importLegacyReport;Page({data:{maxModules:15,modules:[],isDragging:!1,dragIndex:-1,targetIndex:-1,movableAreaHeight:0,itemHeightPx:0,totalTime:0,presets:[],showNameModal:!1,presetNameDraft:"",showAddModal:!1,moduleNameDraft:"",defaultMode:2,displayModes:["模块时间","总时间","模块+总"]},onShareAppMessage:function(){return{title:"备考计时器：记录专注时长，陪你稳步上岸",path:"/pages/timer-setup/timer-setup"}},onShareTimeline:function(){return{title:"备考计时器：记录专注时长，陪你稳步上岸",query:""}},videoAd:null,adReady:!1,onLoad:function(e){this._unloaded=!1,this._presetAdBusy=!1,this._presetAdFallback=null,this.pageReadyInitialized=!1,this.calculateItemHeight(),this.initModules(),this.fetchPresets(),o(wx)},onLocalRecords:function(){wx.navigateTo({url:"/pages/timer-records/timer-records"})},onReady:function(){var e=this;this.pageReadyInitialized||(this.pageReadyInitialized=!0,this._adInitTimer=setTimeout(function(){if(!e._unloaded)try{e.initRewardedVideoAd()}catch(e){console.error("onReady init ad failed",e)}},1e3))},onUnload:function(){this._unloaded=!0,this._presetAdTicket=(this._presetAdTicket||0)+1,clearTimeout(this._adInitTimer),clearTimeout(this._presetShowTimer);var e=this.videoAd,t=this._adHandlers;if(this.videoAd=null,this._adHandlers=null,e){for(var a=0,n=[["offLoad",t&&t.load],["offError",t&&t.error],["offClose",t&&t.close]];a<n.length;a++){var o=i._(n[a],2),s=o[0],r=o[1];try{"function"==typeof e[s]&&r&&e[s](r)}catch(e){}}try{"function"==typeof e.destroy&&e.destroy()}catch(e){}}this._presetAdBusy=!1,this._presetAdFallback=null,this.adReady=!1,this.pendingPresetName=null},initRewardedVideoAd:function(){var e=this;if(!this._unloaded&&!this.videoAd&&wx.createRewardedVideoAd)try{var t=wx.createRewardedVideoAd({adUnitId:"adunit-73025744ccf291a4"});if(!t||"function"!=typeof t.show||"function"!=typeof t.load)return;this.videoAd=t;var a=function(){return!e._unloaded&&e.videoAd===t};this._adHandlers={load:function(){a()&&(e.adReady=!0,console.log("激励视频 广告加载成功"))},error:function(t){a()&&(e.adReady=!1,console.error("激励视频广告加载失败",t),e._presetAdBusy&&e._presetAdFallback&&e._presetAdFallback(t))},close:function(t){if(a()&&e._presetAdBusy&&e.pendingPresetName)if(e._presetAdBusy=!1,e._presetAdFallback=null,e._presetAdTicket=(e._presetAdTicket||0)+1,t&&t.isEnded||void 0===t){var i=e.pendingPresetName||e.generatePresetName();e.pendingPresetName=null,e.savePresetToCloud(i,{silent:!1})}else e.pendingPresetName=null,wx.showToast({title:"需观看完视频才能保存",icon:"none"})}},t.onLoad(this._adHandlers.load),t.onError(this._adHandlers.error),t.onClose(this._adHandlers.close)}catch(e){console.error("创建激励视频广告失败",e)}},noop:function(){},generatePresetName:function(){var e=new Date,t=function(e){return e<10?"0".concat(e):"".concat(e)};return"顺序".concat(e.getFullYear()).concat(t(e.getMonth()+1)).concat(t(e.getDate()),"-").concat(t(e.getHours())).concat(t(e.getMinutes()))},onSavePreset:function(){this.data.modules.length>15?wx.showToast({title:"最多支持15个模块，请先删减",icon:"none"}):wx.cloud?this.data.presets.length>=3?wx.showToast({title:"最多保存3个预设",icon:"none"}):this.setData({showNameModal:!0,presetNameDraft:""}):wx.showToast({title:"云能力未初始化",icon:"none"})},onPresetNameInput:function(e){this.setData({presetNameDraft:e.detail.value})},onCancelNameModal:function(){this.setData({showNameModal:!1,presetNameDraft:""})},onConfirmNameModal:function(){var e=this;if(!this._unloaded&&!this._presetAdBusy){var t=(this.data.presetNameDraft||"").trim()||this.generatePresetName(),a=this._presetAdTicket=(this._presetAdTicket||0)+1;this._presetAdBusy=!0,this.pendingPresetName=t,this.setData({showNameModal:!1},function(){if(!e._unloaded&&a===e._presetAdTicket){e.videoAd||e.initRewardedVideoAd();var i=e.videoAd,n=function(){return!e._unloaded&&a===e._presetAdTicket&&e._presetAdBusy&&e.videoAd===i},o=function(a){n()&&(console.error("激励视频 广告显示失败",a),e.pendingPresetName=null,e._presetAdBusy=!1,e._presetAdFallback=null,e._presetAdTicket++,e.savePresetToCloud(t,{adUnavailable:!0}))};if(e._presetAdFallback=o,i){try{wx.hideKeyboard()}catch(e){}wx.nextTick(function(){n()&&(e._presetShowTimer=setTimeout(function(){if(n()){var t=function(){return Promise.resolve().then(function(){return n()?i.show():void 0}).catch(function(){if(n())return Promise.resolve().then(function(){return n()?i.load():void 0}).then(function(){return n()?i.show():void 0})}).catch(o)};e.adReady?t():Promise.resolve().then(function(){return n()?i.load():void 0}).then(function(){if(n())return e.adReady=!0,t()}).catch(o)}},500))})}else o(Error("激励视频广告未能创建"))}})}},calculateItemHeight:function(){var e=200*(wx.getSystemInfoSync().windowWidth/750);this.setData({itemHeightPx:e})},initModules:function(){var e=wx.getStorageSync("timerModules");Array.isArray(e)&&e.length>0?this.updateModulesPosition(e):this.updateModulesPosition([{id:1,name:"资料分析",duration:30},{id:2,name:"判断推理",duration:35},{id:3,name:"言语理解",duration:35},{id:4,name:"政治理论",duration:5},{id:5,name:"常识判断",duration:5},{id:6,name:"数量关系",duration:10}])},calculateTotalTime:function(e){if(Array.isArray(e)){var t=e.reduce(function(e,t){return e+t.duration},0);this.setData({totalTime:t})}},saveModules:function(e){var t=e.map(function(e){return{id:e.id,name:e.name,duration:e.duration}});wx.setStorageSync("timerModules",t)},updateModulesPosition:function(e){var i=wx.getSystemInfoSync(),n=this.data.itemHeightPx||200*(i.windowWidth/750),o=e.map(function(e,i){return a._(t._({},e),{y:i*n,zIndex:1})});this.setData({modules:o,movableAreaHeight:o.length*n}),this.calculateTotalTime(o),this.saveModules(o)},onManualDragStart:function(t){var a=this,i=t.currentTarget.dataset.index,n=t.touches[0];this.dragStartY=n.clientY,this.dragStartItemY=this.data.modules[i].y,this.isDragActive=!1,this.dragTimer=setTimeout(function(){a.isDragActive=!0,wx.vibrateShort({type:"medium"}),a.setData(e._({isDragging:!0,dragIndex:i,targetIndex:i},"modules[".concat(i,"].zIndex"),100))},150)},onManualDragMove:function(i){var n=i.touches[0].clientY-this.dragStartY;if(!this.isDragActive){Math.abs(n)>10&&clearTimeout(this.dragTimer);return}var o=this.data,s=o.dragIndex,r=o.targetIndex,d=o.modules,u=wx.getSystemInfoSync(),l=this.data.itemHeightPx||200*(u.windowWidth/750),c=this.dragStartItemY+n;this.setData(e._({},"modules[".concat(s,"].y"),c));var h=Math.floor((c+l/2)/l);if(h<0&&(h=0),h>=d.length&&(h=d.length-1),h!==r){var m=d.map(function(e,i){if(i===s)return e;var n=i*l;return(s<h?i>s&&i<=h&&(n-=l):s>h&&i>=h&&i<s&&(n+=l),e.y!==n)?a._(t._({},e),{y:n}):e});this.setData({modules:m,targetIndex:h})}},onManualDragEnd:function(t){var a,n=this;if(clearTimeout(this.dragTimer),this.isDragActive){this.isDragActive=!1;var o=this.data,s=o.dragIndex,r=o.targetIndex,d=o.modules,u=wx.getSystemInfoSync(),l=this.data.itemHeightPx||200*(u.windowWidth/750);if(s===r)return void this.setData((a={isDragging:!1,dragIndex:-1,targetIndex:-1},e._(a,"modules[".concat(s,"].zIndex"),1),e._(a,"modules[".concat(s,"].y"),s*l),a));d[s];var c=d.map(function(e){return{id:e.id,name:e.name,duration:e.duration}}),h=i._(c.splice(s,1),1)[0];c.splice(r,0,h),this.setData({isDragging:!1,dragIndex:-1,targetIndex:-1},function(){setTimeout(function(){n.updateModulesPosition(c)},50)})}},onSliderChange:function(e){var t=e.currentTarget.dataset.index;this.updateDuration(t,e.detail.value,!0)},onSliderChanging:function(e){var t=e.currentTarget.dataset.index;this.updateDuration(t,e.detail.value,!1)},increaseTime:function(e){var t=e.currentTarget.dataset.index,a=this.data.modules[t].duration;this.updateDuration(t,a+1,!0)},decreaseTime:function(e){var t=e.currentTarget.dataset.index,a=this.data.modules[t].duration;this.updateDuration(t,a-1,!0)},updateDuration:function(t,a){var i=this,n=arguments.length>2&&void 0!==arguments[2]&&arguments[2];a<0&&(a=0),a>60&&(a=60),this.setData(e._({},"modules[".concat(t,"].duration"),a),function(){i.calculateTotalTime(i.data.modules),n&&i.saveModules(i.data.modules)})},fetchPresets:function(){var e=this;wx.cloud&&wx.cloud.database().collection("timer_presets").get().then(function(a){if(a.data&&a.data.length>0){var i=a.data[0],n=(Array.isArray(i.presets)?i.presets:[]).map(function(e){var a=t._({},e),i=a.name||"";return i&&i.length>6?a.displayName=i.substring(0,6):a.displayName=i,a});e.setData({presets:n,userDocId:i._id})}else e.setData({presets:[],userDocId:null})}).catch(function(e){console.error("Failed to fetch presets",e)})},savePresetToCloud:function(e){var t=this,a=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(!this._savingPreset&&!this._unloaded){if(!this.data.modules.length||this.data.modules.length>15)return void wx.showToast({title:"请保留1至15个模块",icon:"none"});this._savingPreset=!0;var i=a.silent,n=void 0!==i&&i,o=a.adUnavailable,s=void 0!==o&&o,r={id:"preset_"+Date.now()+"_"+Math.floor(1e3*Math.random()),name:e,modules:this.data.modules.map(function(e){return{id:e.id,name:e.name,duration:e.duration}}),totalDuration:this.data.totalTime,moduleCount:this.data.modules.length,createTime:new Date},d=wx.cloud.database(),u=d.command;return(n||wx.showLoading({title:"保存中"}),this.data.userDocId)?d.collection("timer_presets").doc(this.data.userDocId).update({data:{presets:u.push(r)}}).then(function(){n||(wx.hideLoading(),wx.showToast({title:s?"广告未显示，已保存":"保存成功"})),t._unloaded||t.fetchPresets()}).catch(function(e){n||wx.hideLoading(),console.error("Update preset failed",e),n||wx.showToast({title:"保存失败",icon:"none"})}).finally(function(){t._savingPreset=!1}):d.collection("timer_presets").add({data:{presets:[r]}}).then(function(){n||(wx.hideLoading(),wx.showToast({title:s?"广告未显示，已保存":"保存成功"})),t._unloaded||t.fetchPresets()}).catch(function(e){n||wx.hideLoading(),console.error("Create preset failed",e),n||wx.showToast({title:"保存失败",icon:"none"})}).finally(function(){t._savingPreset=!1})}},onApplyPreset:function(e){var t=e.currentTarget.dataset.index,a=this.data.presets[t];a&&(this.updateModulesPosition(a.modules),wx.showToast({title:"已应用",icon:"success"}))},onDeletePreset:function(e){var t=this,a=e.currentTarget.dataset.index;wx.showModal({title:"删除预设",content:"确定要删除该预设吗？",success:function(e){if(e.confirm&&t.data.userDocId){wx.showLoading({title:"删除中"});var i=wx.cloud.database();i.command;var o=n._(t.data.presets);o.splice(a,1),i.collection("timer_presets").doc(t.data.userDocId).update({data:{presets:o}}).then(function(){wx.hideLoading(),wx.showToast({title:"删除成功"}),t.fetchPresets()}).catch(function(e){wx.hideLoading(),console.error("Delete preset failed",e),wx.showToast({title:"删除失败",icon:"none"})})}}})},deleteModule:function(e){var t=this,a=e.currentTarget.dataset.index;wx.showModal({title:"删除模块",content:'确定要删除"'.concat(this.data.modules[a].name,'"吗？'),success:function(e){if(e.confirm){var i=t.data.modules.map(function(e){return{id:e.id,name:e.name,duration:e.duration}});i.splice(a,1),t.updateModulesPosition(i)}}})},showAddModuleModal:function(){this.data.modules.length>=15?wx.showToast({title:"最多添加15个模块",icon:"none"}):this.setData({showAddModal:!0,moduleNameDraft:""})},showLetterModal:function(){this.setData({showLetterModal:!0})},closeLetterModal:function(){this.setData({showLetterModal:!1})},onModuleNameInput:function(e){this.setData({moduleNameDraft:e.detail.value})},onCancelAddModal:function(){this.setData({showAddModal:!1,moduleNameDraft:""})},onConfirmAddModal:function(){if(this.data.modules.length>=15)return void wx.showToast({title:"最多添加15个模块",icon:"none"});var e=(this.data.moduleNameDraft||"").trim();if(e){var t={id:Date.now(),name:e,duration:15},a=this.data.modules.map(function(e){return{id:e.id,name:e.name,duration:e.duration}});this.updateModulesPosition(n._(a).concat([t]))}this.setData({showAddModal:!1,moduleNameDraft:""})},onModeSelect:function(e){var t=parseInt(e.currentTarget.dataset.mode);this.setData({defaultMode:t})},startTimer:function(){if(this.data.modules.length>15)return void wx.showToast({title:"最多支持15个模块，请先删减",icon:"none"});if(0===this.data.modules.length)return void wx.showToast({title:"请至少添加一个模块",icon:"none"});var e=JSON.stringify(this.data.modules);wx.navigateTo({url:"/pages/timer/timer?modules=".concat(encodeURIComponent(e),"&mode=").concat(this.data.defaultMode)})}}); 
 			}); 	require("pages/timer-setup/timer-setup.js");
 		__wxRoute = 'pages/timer-records/timer-records';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/timer-records/timer-records.js';	define("pages/timer-records/timer-records.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var e=require("../../utils/timer-records.js"),t=e.MAX_RECORDS,r=e.readTimerRecords,o=e.getTimerRecord,n=e.importLegacyReport,i=e.formatElapsed,a=e.formatRecordDate;Page({data:{drafts:[],reports:[],maxRecords:t},onShow:function(){n(wx);var e=r(wx).map(function(e){return{id:e.id,state:e.state,title:e.reportTitle,date:e.legacy?"原有报告 \xb7 时间未记录":a(e.finishedAt||e.savedAt),total:i(e.modules.reduce(function(e,t){return e+t.elapsed},0)),currentModule:e.modules[e.currentModuleIndex].name,moduleCount:e.modules.length}});this.setData({drafts:e.filter(function(e){return"draft"===e.state}),reports:e.filter(function(e){return"finished"===e.state})})},onOpenRecord:function(e){var t=this;if(!this._opening){var r=o(wx,e.currentTarget.dataset.id);if(!r){wx.showToast({title:"记录已不存在",icon:"none"}),this.onShow();return}this._opening=!0;var n="draft"===r.state?"/pages/timer/timer?resume=":"/pages/timer-report/timer-report?recordId=";wx.navigateTo({url:n+encodeURIComponent(r.id),complete:function(){t._opening=!1}})}}}); 
 			}); 	require("pages/timer-records/timer-records.js");
 		__wxRoute = 'pages/timer/timer';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/timer/timer.js';	define("pages/timer/timer.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../@swc/runtime/_define_property"),e=require("../../@swc/runtime/_object_spread"),i=require("../../@swc/runtime/_object_spread_props"),s=require("../../utils/timer-records.js"),r=s.cleanModules,n=s.createRecordId,a=s.getTimerRecord,o=s.saveTimerRecord;Page({data:{timeStr:"00:00:00",totalTimeStr:"00:00:00",seconds:0,totalSeconds:0,timeDisplayMode:2,localBackupFailed:!1,isRunning:!1,showTip:!1,timerId:null,modules:[],currentModuleIndex:0,scrollTop:0},onShareAppMessage:function(){return{title:"备考计时器：记录专注时长，陪你稳步上岸",path:"/pages/timer-setup/timer-setup"}},onShareTimeline:function(){return{title:"备考计时器：记录专注时长，陪你稳步上岸",query:""}},onLoad:function(){var t,s=this,o=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};this._ready=!1,this._finished=!1,this._submitting=!1;var d=o.resume?a(wx,o.resume):null;if(o.resume&&(!d||"draft"!==d.state)){wx.showToast({title:"该计时记录已不可恢复",icon:"none"}),wx.redirectTo({url:"/pages/timer-records/timer-records"});return}if(d)t=d.modules;else try{t=r(JSON.parse(decodeURIComponent(o.modules||"")))}catch(t){}if(!t)return void wx.redirectTo({url:"/pages/timer-setup/timer-setup"});this._recordId=d?d.id:n(),this._startedAt=d?d.startedAt:Date.now();var l=Number(o.mode),c=d?d.currentModuleIndex:0,u=t.map(function(t){return i._(e._({},t),{elapsed:d?t.elapsed:0})});this.setData({modules:u,currentModuleIndex:c,isRunning:!1,seconds:u[c].elapsed,totalSeconds:u.reduce(function(t,e){return t+e.elapsed},0),timeDisplayMode:d?d.timeDisplayMode:[0,1,2].includes(l)?l:2}),this._ready=!0,this.updateTimeStr(),d?(this.persistBackup(),wx.showToast({title:"已恢复，点击播放继续",icon:"none"})):this.startTimer(),this._initialScrollTimer=setTimeout(function(){return s.scrollToModule(c)},300),this.setData({showTip:!0}),this._tipTimer=setTimeout(function(){return s.setData({showTip:!1})},3e3),wx.setKeepScreenOn({keepScreenOn:!0})},onShow:function(){this._ready&&wx.setKeepScreenOn({keepScreenOn:!0})},onHide:function(){this.cancelSubmission(),this.stopTimer(),wx.setKeepScreenOn({keepScreenOn:!1})},onUnload:function(){this.cancelSubmission(),this.stopTimer(),this._ready=!1,clearTimeout(this._initialScrollTimer),clearTimeout(this._tipTimer),clearTimeout(this._tapFeedbackTimer),clearInterval(this.pressInterval),wx.setKeepScreenOn({keepScreenOn:!1})},startTimer:function(){var t=this;!this._ready||this._finished||this.data.isRunning||(this._lastTickAt=Date.now(),this.setData({isRunning:!0}),this.persistBackup(),this.data.timerId=setInterval(function(){t._ready&&t.data.isRunning&&!t._finished&&(t.accountElapsedTime(),Date.now()-t._lastBackupAt>=5e3&&t.persistBackup())},1e3))},accountElapsedTime:function(){if(this.data.isRunning&&Number.isFinite(this._lastTickAt)){var e,i=Date.now();if(i<this._lastTickAt){this._lastTickAt=i;return}var s=Math.floor((i-this._lastTickAt)/1e3);if(s){this._lastTickAt+=1e3*s;var r=this.data.currentModuleIndex,n=this.data.modules[r].elapsed+s;this.setData((e={},t._(e,"modules[".concat(r,"].elapsed"),n),t._(e,"seconds",n),t._(e,"totalSeconds",this.data.totalSeconds+s),e)),this.updateTimeStr()}}},persistBackup:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"draft";if(!this._ready||this._finished&&"finished"!==t)return!0;var e=Date.now(),i=o(wx,{id:this._recordId,state:t,modules:this.data.modules,currentModuleIndex:this.data.currentModuleIndex,timeDisplayMode:this.data.timeDisplayMode,startedAt:this._startedAt,savedAt:e,finishedAt:"finished"===t?e:null});return this._lastBackupAt=e,!i!==this.data.localBackupFailed&&this.setData({localBackupFailed:!i}),i||this._backupFailureNotified?i&&(this._backupFailureNotified=!1):(this._backupFailureNotified=!0,wx.showToast({title:"本地备份失败，请留意",icon:"none"})),i},switchModule:function(t){var e,i=this;if(e=Number(e="number"==typeof t?t:t.currentTarget.dataset.index),this._ready&&!this._finished&&Number.isInteger(e)&&this.data.modules[e]){if(e===this.data.currentModuleIndex)return void this.scrollToModule(e);this.stopTimer();var s=this.data.modules[e];this.setData({currentModuleIndex:e,seconds:s.elapsed||0},function(){wx.nextTick(function(){i.scrollToModule(e)})}),this.updateTimeStr(),this.startTimer()}},onSubmitTouchStart:function(){var t=this;!this._ready||this._finished||this._submitting||(this.cancelSubmission(),this.longPressTriggered=!1,this.setData({isPressing:!0,progressPercent:0}),this.pressStartTime=Date.now(),this.pressInterval=setInterval(function(){var e=Date.now()-t.pressStartTime,i=100*Math.min(e/800,1);(Math.abs(i-t.data.progressPercent)>1||i>=100)&&t.setData({progressPercent:i}),e>=800&&(t.longPressTriggered=!0,clearInterval(t.pressInterval),t.pressInterval=null,t.setData({progressPercent:100}),t._submitDelay=setTimeout(function(){t.handleLongPressSuccess()},200))},50))},onSubmitTouchEnd:function(){var t=this;this.longPressTriggered?this.setData({isPressing:!1}):Date.now()-this.pressStartTime<200?(this.setData({progressPercent:33}),this._tapFeedbackTimer=setTimeout(function(){t.longPressTriggered||t.setData({isPressing:!1,progressPercent:0})},200)):this.setData({isPressing:!1,progressPercent:0}),this.pressInterval&&(clearInterval(this.pressInterval),this.pressInterval=null)},handleLongPressSuccess:function(){!this._ready||this._finished||this._submitting||(this.longPressTriggered=!0,this.pressInterval&&(clearInterval(this.pressInterval),this.pressInterval=null),wx.vibrateShort({type:"heavy"}),this.finishExam())},onSubmitTap:function(){if(this._finished){this._submitting||this.openSavedReport();return}this.longPressTriggered||wx.showToast({title:"长按提交",icon:"none",duration:1e3})},finishExam:function(){if(this._ready&&!this._submitting){if(this._submitting=!0,this.stopTimer(!1),!this.persistBackup("finished")){this._submitting=!1,this.longPressTriggered=!1,wx.showToast({title:"本地保存失败，请再提交",icon:"none"});return}this._finished=!0,wx.vibrateLong();try{wx.setStorageSync("reportData",this.data.modules)}catch(t){}this.openSavedReport()}},openSavedReport:function(){var t=this;this._submitting=!0,wx.redirectTo({url:"/pages/timer-report/timer-report?recordId="+encodeURIComponent(this._recordId),fail:function(e){t._submitting=!1,t.longPressTriggered=!1,console.error("Redirect failed:",e),wx.showToast({title:"报告已保存，请再点提交",icon:"none"})}})},nextModule:function(){var t=this.data.currentModuleIndex+1;t<this.data.modules.length?this.switchModule(t):this.finishExam()},scrollToModule:function(t){var e=this,i=wx.createSelectorQuery();i.select(".module-list").fields({scrollOffset:!0,size:!0}),i.select("#module-".concat(t)).boundingClientRect(),i.select(".module-list").boundingClientRect(),i.exec(function(t){var i=t[0],s=t[1],r=t[2];if(i&&s&&r){var n=i.scrollTop+(s.top-r.top)+s.height/2-r.height/2;n<0&&(n=0),e.setData({scrollTop:n})}})},stopTimer:function(){var t=!(arguments.length>0)||void 0===arguments[0]||arguments[0];this._ready&&(this.accountElapsedTime(),this.data.timerId&&(clearInterval(this.data.timerId),this.data.timerId=null),this.setData({isRunning:!1}),t&&this.persistBackup())},toggleTimer:function(){this.data.isRunning?this.stopTimer():this.startTimer()},updateTimeStr:function(){var t=function(t){var e=Math.floor(t/3600),i=Math.floor(t%3600/60),s=function(t){return t.toString().padStart(2,"0")};return"".concat(s(e),":").concat(s(i),":").concat(s(t%60))},e=t(this.data.seconds),i=t(this.data.totalSeconds||0);this.setData({timeStr:e,totalTimeStr:i})},onMainTap:function(){this.toggleDisplayMode()},toggleDisplayMode:function(){this.setData({timeDisplayMode:(this.data.timeDisplayMode+1)%3}),this.persistBackup()},cancelSubmission:function(){clearInterval(this.pressInterval),clearTimeout(this._submitDelay),this.pressInterval=null,this._ready&&this.setData({isPressing:!1,progressPercent:0})},preventBubble:function(){}}); 
 			}); 	require("pages/timer/timer.js");
 		__wxRoute = 'pages/timer-report/timer-report';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/timer-report/timer-report.js';	define("pages/timer-report/timer-report.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../@swc/runtime/_async_to_generator"),e=require("../../@swc/runtime/_object_spread"),i=require("../../@swc/runtime/_object_spread_props"),a=require("../../@swc/runtime/_ts_generator"),l=require("../../utils/timer-records.js"),o=l.cleanModules,n=l.createRecordId,r=l.getTimerRecord,s=l.readTimerRecords,c=l.saveTimerRecord,d=l.importLegacyReport,f=l.formatRecordDate,h=require("../../utils/image-export.js");Page({data:{reportTitle:"模考训练分析报告",reportDate:"",localReportSaved:!1,totalActualTime:0,totalPlannedTime:0,timeDeviation:0,deviationText:"",completionRate:0,overtimeCount:0,totalModules:0,complianceRate:0,modules:[],canvasWidth:750,canvasHeight:1334},onLoad:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};this._unloaded=!1,d(wx);var e=t.recordId?r(wx,t.recordId):s(wx).find(function(t){return"finished"===t.state});if(t.recordId&&(!e||"finished"!==e.state))return void wx.showToast({title:"该报告已不存在",icon:"none"});var i=e&&e.modules;if(!i&&t.modules)try{i=o(JSON.parse(decodeURIComponent(t.modules)))}catch(t){}if(!i)try{i=o(wx.getStorageSync("reportData"))}catch(t){}if(!i)return void wx.showToast({title:"无数据",icon:"none"});if(e)this.setData({localReportSaved:!0});else{var a=Date.now();e={id:n(),state:"finished",modules:i,startedAt:a,savedAt:a,finishedAt:null,timeDisplayMode:2,currentModuleIndex:0,legacy:!0,reportTitle:this.data.reportTitle},this.setData({localReportSaved:c(wx,e)})}this._localRecord=e,this.generateReport(i),this.setData({reportTitle:e.reportTitle||this.data.reportTitle,reportDate:e.legacy?"时间未记录":f(e.finishedAt||e.savedAt)})},generateReport:function(t){var a=this,l=0,o=0,n=0,r=t.map(function(t){var r=t.elapsed||0,s=60*t.duration,c=r-s;return l+=r,o+=s,r>s&&n++,i._(e._({},t),{actualStr:a.formatTime(r),timeParts:a.getTimeParts(r),plannedStr:a.formatTime(s),deviationStr:(c>0?"+":"")+a.formatTime(Math.abs(c)),deviationClass:c>0?"negative":"positive"})}),s=l-o;this.setData({modules:r,totalModules:t.length,totalActualTime:l,totalActualStr:this.formatTime(l),totalActualParts:this.getTimeParts(l),totalPlannedTime:o,totalPlannedStr:this.formatTime(o),timeDeviation:s,timeDeviationStr:(s>0?"+":"")+this.formatTime(Math.abs(s)),deviationText:s>0?"晚于":"早于",deviationClass:s>0?"negative":"positive",overtimeCount:n,complianceRate:Math.round((t.length-n)/t.length*100)||0,completionRate:100})},formatTime:function(t){var e=Math.abs(t),i=Math.floor(e/60);return"".concat(i.toString().padStart(2,"0"),":").concat((e%60).toString().padStart(2,"0"))},getTimeParts:function(t){var e=Math.abs(t);return{mm:Math.floor(e/60).toString().padStart(2,"0"),ss:(e%60).toString().padStart(2,"0")}},onUnload:function(){this._unloaded=!0,this._imageJob&&this._imageJob.cancel()},onHide:function(){this._imageJob&&"saving"!==this._imageJob.phase&&this._imageJob.cancel()},onMemoryPressure:function(){this._imageJob&&"saving"!==this._imageJob.phase&&this._imageJob.cancel()},onPrint:function(){return t._(function(){var t,e,i,l,o,n,r,s,c,d,f,T,u,x,m,p,g,R,v,A,S,w,_,D,b,y,E,P,K,M,I,L,F;return a._(this,function(a){switch(a.label){case 0:if(t=this,this._imageJob||this._unloaded||!this.data.modules.length)return[2];e=this._imageJob=h.createJob(),a.label=1;case 1:return a.trys.push([1,6,7,8]),wx.showLoading({title:"生成中..."}),i=1300,l=80,o=400,n=300,r=60,c=i-(s=l+o+80)-l,d=160,f=30,T=Math.max(2*n+r+200,100+this.data.modules.length*(d+f)),u=Math.max(l+300+T+l+80,1.33*i),x=h.bitmapSize(i,u,"details"),[4,e.wait(function(e){return t.setData({canvasHeight:u,canvasWidth:i},e)})];case 2:return a.sent(),[4,e.wait(function(e){return wx.createSelectorQuery().in(t).select("#shareCanvas").fields({node:!0,size:!0}).exec(e)})];case 3:if(m=a.sent(),e.check(),!(p=m&&m[0]&&m[0].node)||(e.canvas=p,p.width=x.width,p.height=x.height,!(g=p.getContext("2d"))))throw Error("图片画布未就绪，请重试");return g.scale(x.scale,x.scale),g.fillStyle=(R={BG:"#FFFFFF",DARK:"#2C3E50",WHITE:"#FFFFFF",YELLOW:"#FAD390",MINT:"#55E6C1",PINK:"#FF9EAA",BLUE:"#74B9FF",RED_TEXT:"#E74C3C",GREEN_TEXT:"#27AE60",GRAY_TEXT:"#636E72",GRID:"#E0E0E0"}).BG,g.fillRect(0,0,i,u),g.lineWidth=12,g.strokeStyle=R.DARK,g.beginPath(),g.moveTo(60,20),g.lineTo(i-20-40,20),g.quadraticCurveTo(i-20,20,i-20,60),g.lineTo(i-20,u-20-40),g.quadraticCurveTo(i-20,u-20,i-20-40,u-20),g.lineTo(60,u-20),g.quadraticCurveTo(20,u-20,20,u-20-40),g.lineTo(20,60),g.quadraticCurveTo(20,20,60,20),g.closePath(),g.stroke(),h.drawReportLabel(g,i,"行测小助理 \xb7 计时报告",{left:110,top:62,fontSize:24}),v=l+40,g.font="900 64px sans-serif",A=g.measureText(this.data.reportTitle).width+80,g.fillStyle=R.DARK,this.drawRoundedRect(g,l+40,v,A,120,0,null,0,R.DARK),g.fillStyle=R.YELLOW,this.drawRoundedRect(g,l+30,v-10,A,120,10,R.DARK,4,R.YELLOW),g.textBaseline="middle",g.textAlign="left",g.fillStyle=R.DARK,g.fillText(this.data.reportTitle,l+30+40,v+50),v+=180,S=v,g.font="bold 28px sans-serif",w=this.data.reportDate,g.fillStyle=R.WHITE,this.drawRoundedRect(g,l+40,S,340,60,30,R.DARK,3,R.WHITE),g.fillStyle=R.DARK,g.fillText("\uD83D\uDDD3 "+w,l+70,S+34),g.fillStyle=R.MINT,_=i-l-40-180,this.drawRoundedRect(g,_,S,180,60,30,R.DARK,3,R.MINT),g.fillStyle=R.DARK,g.textAlign="center",g.fillText("✅ 已完成",_+90,S+34),v+=100,D=v,g.fillStyle="rgba(255, 255, 255, 0.6)",this.drawShadowRect(g,l+40,D,o,n,20,R.WHITE,R.DARK,10),g.beginPath(),g.moveTo(l+40,D+60),g.lineTo(l+40+o,D+60),g.strokeStyle=R.DARK,g.lineWidth=3,g.stroke(),g.fillStyle=R.PINK,g.beginPath(),g.arc(l+80,D+30,20,0,2*Math.PI),g.fill(),g.stroke(),g.textAlign="left",g.fillStyle=R.DARK,g.font="900 28px sans-serif",g.fillText("实际总用时",l+120,D+30),g.textAlign="center",g.font="900 72px monospace",b=this.data.totalActualParts,g.measureText(":").width,g.measureText(b.mm).width,g.measureText(b.ss).width,y=l+40+o/2,E=D+150,g.font="900 72px monospace",g.textAlign="right",g.fillText(b.mm,y-10,E),g.textAlign="center",g.fillText(":",y,E-5),g.font="900 60px monospace",g.textAlign="left",g.fillText(b.ss,y+10,E),g.font="bold 20px sans-serif",g.textAlign="center",g.fillStyle=R.GRAY_TEXT,g.fillText("计划: ".concat(this.data.totalPlannedStr),l+40+o/2,D+220),P=D+n+r,this.drawShadowRect(g,l+40,P,o,n,20,R.BLUE,R.DARK,10),g.beginPath(),g.moveTo(l+40,P+60),g.lineTo(l+40+o,P+60),g.stroke(),g.fillStyle=R.YELLOW,g.beginPath(),g.arc(l+80,P+30,20,0,2*Math.PI),g.fill(),g.stroke(),g.textAlign="left",g.fillStyle=R.DARK,g.font="900 28px sans-serif",g.fillText("超时模块",l+120,P+30),g.textAlign="center",g.font="900 80px sans-serif",g.fillText(this.data.overtimeCount,l+40+o/2,P+150),g.font="bold 24px sans-serif",g.fillText("达标率 ".concat(this.data.complianceRate,"%"),l+40+o/2,P+220),K=P+n+60,this.drawShadowRect(g,l+40,K,o,160,20,R.WHITE,R.DARK,8),g.fillStyle=R.YELLOW,g.font="900 100px sans-serif",g.textAlign="left",g.textBaseline="top",g.fillText("“",l+60,K+10),g.fillStyle=R.DARK,g.font="bold 32px sans-serif",g.textAlign="left",g.fillText("不积跬步",l+120,K+50),g.fillText("无以至千里",l+120,K+94),g.font="bold 24px sans-serif",g.fillStyle=R.GRAY_TEXT,g.textAlign="right",g.fillText("— 荀子",l+40+o-30,K+120),g.fillStyle=R.DARK,M=D,this.drawRoundedRect(g,s,M,240,60,0,null,0,R.DARK),g.fillStyle=R.WHITE,g.font="900 32px sans-serif",g.textAlign="center",g.fillText("各模块用时",s+120,M+30),I=D+80,this.data.modules.forEach(function(e,i){var a=I+i*(d+f);t.drawShadowRect(g,s,a,c,d,15,R.WHITE,R.DARK,6),g.fillStyle=i%2==0?R.YELLOW:R.MINT,g.strokeStyle=R.DARK,g.lineWidth=2,g.beginPath(),g.moveTo(s+100,a),g.lineTo(s+15,a),g.arcTo(s,a,s,a+15,15),g.lineTo(s,a+d-15),g.arcTo(s,a+d,s+15,a+d,15),g.lineTo(s+100,a+d),g.lineTo(s+100,a),g.closePath(),g.fill(),g.stroke(),g.fillStyle=R.DARK,g.fillStyle=R.DARK,g.font="900 48px sans-serif",g.textAlign="center",g.textBaseline="middle",g.fillText((i+1).toString().padStart(2,"0"),s+50,a+d/2+4);var l=s+130,o=s+c-30;g.textAlign="left",g.textBaseline="bottom",g.fillStyle=R.DARK,g.font="900 32px sans-serif";var n=e.name;n.length>8&&(n=n.substring(0,8)+".."),g.fillText(n,l,a+d/2-10);var r=e.timeParts,h=a+d/2-6;g.font="900 65px monospace",g.textAlign="right",g.fillText(r.mm,o-70,h),g.textAlign="center",g.fillText(":",o-55,h-5),g.font="900 55px monospace",g.textAlign="left",g.fillText(r.ss,o-40,h),g.textAlign="left",g.textBaseline="top",g.fillStyle=R.GRAY_TEXT,g.font="bold 22px sans-serif",g.fillText("计划: ".concat(e.plannedStr),l,a+d/2+10);var T="negative"===e.deviationClass;g.textAlign="left",g.fillStyle=T?R.RED_TEXT:R.GREEN_TEXT;var u=g.measureText("计划: ".concat(e.plannedStr)).width;g.fillText("".concat(T?"⚠️":"⚡"," ").concat(e.deviationStr),l+u+30,a+d/2+10)}),e.check(),[4,h.exportCanvas(p,e)];case 4:if(L=a.sent(),e.release(),!L||!L.tempFilePath)throw Error("图片生成失败，请重试");return[4,h.saveToAlbum(L.tempFilePath,e)];case 5:return a.sent()&&!this._unloaded&&wx.showToast({title:"已保存到相册",icon:"success"}),[3,8];case 6:return(F=a.sent()).cancelled||this._unloaded||(console.error("Timer report export failed",F),wx.showToast({title:"图片保存失败，请重试",icon:"none"})),[3,8];case 7:return e.active=!1,e.release(),this._imageJob===e&&(this._imageJob=null),this._unloaded||wx.hideLoading(),[7];case 8:return[2]}})}).call(this)},drawShadowRect:function(t,e,i,a,l,o,n,r,s){void 0===s&&(s=6),this.drawRoundedRect(t,e+s,i+s,a,l,o,null,0,r),this.drawRoundedRect(t,e,i,a,l,o,r,2,n)},drawRoundedRect:function(t,e,i,a,l,o,n,r,s){t.beginPath(),t.moveTo(e+o,i),t.lineTo(e+a-o,i),t.arcTo(e+a,i,e+a,i+l,o),t.lineTo(e+a,i+l-o),t.arcTo(e+a,i+l,e+a-o,i+l,o),t.lineTo(e+o,i+l),t.arcTo(e,i+l,e,i+l-o,o),t.lineTo(e,i+o),t.arcTo(e,i,e+o,i,o),t.closePath(),s&&(t.fillStyle=s,t.fill()),n&&(t.strokeStyle=n,t.lineWidth=r||2,t.stroke())},onRestart:function(){wx.reLaunch({url:"/pages/index/index"})},onEditTitle:function(){var t=this;wx.showModal({title:"修改报告标题",editable:!0,content:this.data.reportTitle,placeholderText:"请输入新的标题",success:function(a){if(a.confirm&&a.content){var l=a.content.trim().slice(0,100);if(l&&(t.setData({reportTitle:l}),t._localRecord)){t._localRecord=i._(e._({},t._localRecord),{reportTitle:l,savedAt:Date.now()});var o=c(wx,t._localRecord);t.setData({localReportSaved:o}),o||wx.showToast({title:"标题未能保存到本机",icon:"none"})}}}})}}); 
 			}); 	require("pages/timer-report/timer-report.js");
 		__wxRoute = 'pages/letter/letter';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/letter/letter.js';	define("pages/letter/letter.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Page({goBack:function(){var e=getCurrentPages(),n=e.length>1?e[e.length-2]:null;n&&"pages/index/index"===n.route?wx.navigateBack({delta:1}):wx.reLaunch({url:"/pages/index/index"})}}); 
 			}); 	require("pages/letter/letter.js");
 		__wxRoute = 'pages/user-list/user-list';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/user-list/user-list.js';	define("pages/user-list/user-list.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),s=require("../../@swc/runtime/_to_consumable_array"),t=require("../../@swc/runtime/_ts_generator"),a=require("../../utils/cloud.js").getAllUsers;Page({data:{users:[],loading:!1,page:0,pageSize:20,hasMore:!0},onLoad:function(){this.loadUsers()},loadUsers:function(){return e._(function(){var e;return t._(this,function(t){switch(t.label){case 0:if(this.data.loading||!this.data.hasMore)return[2];this.setData({loading:!0}),t.label=1;case 1:return t.trys.push([1,3,4,5]),[4,a(this.data.page*this.data.pageSize,this.data.pageSize)];case 2:return(e=t.sent()).length<this.data.pageSize&&this.setData({hasMore:!1}),this.setData({users:s._(this.data.users).concat(s._(e)),page:this.data.page+1}),[3,5];case 3:return console.error("Failed to load users",t.sent()),wx.showToast({title:"加载失败",icon:"none"}),[3,5];case 4:return this.setData({loading:!1}),[7];case 5:return[2]}})}).call(this)},onReachBottom:function(){this.loadUsers()},onPullDownRefresh:function(){var e=this;this.setData({users:[],page:0,hasMore:!0,loading:!1},function(){e.loadUsers().then(function(){wx.stopPullDownRefresh()})})}}); 
 			}); 	require("pages/user-list/user-list.js");
 		__wxRoute = 'pages/admin/report-list/report-list';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/admin/report-list/report-list.js';	define("pages/admin/report-list/report-list.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../../@swc/runtime/_async_to_generator"),e=require("../../../@swc/runtime/_object_spread"),a=require("../../../@swc/runtime/_object_spread_props"),r=require("../../../@swc/runtime/_ts_generator"),s=require("../../../utils/cloud.js"),o=s.getErrorReports,i=s.formatDate;Page({data:{reports:[],loading:!1,hasMore:!0,page:0,limit:20},onLoad:function(){this.loadReports()},loadReports:function(){var s=arguments.length>0&&void 0!==arguments[0]&&arguments[0];return t._(function(){var t,n;return r._(this,function(r){switch(r.label){case 0:if(this.data.loading||!s&&!this.data.hasMore)return[2];this.setData({loading:!0}),s&&this.setData({page:0,reports:[],hasMore:!0}),r.label=1;case 1:return r.trys.push([1,3,,4]),[4,o(this.data.page*this.data.limit,this.data.limit)];case 2:return n=(t=r.sent()).map(function(t){return a._(e._({},t),{timeStr:i(t.createTime)})}),this.setData({reports:this.data.reports.concat(n),page:this.data.page+1,hasMore:t.length===this.data.limit,loading:!1}),[3,4];case 3:return console.error("Load reports failed",r.sent()),this.setData({loading:!1}),[3,4];case 4:return[2]}})}).call(this)},onPullDownRefresh:function(){this.loadReports(!0).then(function(){wx.stopPullDownRefresh()})},onReachBottom:function(){this.loadReports()},onCopyContact:function(t){var e=t.currentTarget.dataset.content;e&&wx.setClipboardData({data:e,success:function(){wx.showToast({title:"已复制微信号",icon:"success"})}})}}); 
 			}); 	require("pages/admin/report-list/report-list.js");
 		__wxRoute = 'pages/math-tools/menu/menu';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/math-tools/menu/menu.js';	define("pages/math-tools/menu/menu.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Page({data:{},onPercentageTap:function(){wx.navigateTo({url:"/pages/math-tools/percentage/percentage"})}}); 
 			}); 	require("pages/math-tools/menu/menu.js");
 		__wxRoute = 'pages/math-tools/percentage/percentage';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/math-tools/percentage/percentage.js';	define("pages/math-tools/percentage/percentage.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../../@swc/runtime/_to_consumable_array");getApp(),Page({data:{question:"",denominator:0,inputValue:"",logs:[],startTime:0,timeString:"00:00",timer:null,isRunning:!1,correctCount:0,totalCount:0,showHistory:!0,mode:"forward",questionPercentage:"",questionQueue:[]},onLoad:function(){this.startSession()},onUnload:function(){this.stopTimer()},onToggleHistory:function(){this.setData({showHistory:!this.data.showHistory})},onRestart:function(){var t=this;wx.showModal({title:"重新开始",content:"确定要清空当前进度并重新开始吗？",success:function(e){e.confirm&&t.startSession()}})},onReversePractice:function(){var t="forward"===this.data.mode?"reverse":"forward";wx.showToast({title:"切换到".concat("reverse"===t?"反向":"正向","模式"),icon:"none"}),this.setData({mode:t}),this.startSession()},startSession:function(){this.setData({logs:[],correctCount:0,totalCount:0,startTime:Date.now(),inputValue:"",timeString:"00:00",questionQueue:[]}),this.generateQuestionQueue(),this.startTimer(),this.nextQuestion()},generateQuestionQueue:function(){var e=[6,7,12,13,14,15,16],a=[8,9,11,17,18,19],o=[2,3,4,5,10];"reverse"===this.data.mode&&(e=t._(e).concat(t._([16.7,14.3,8.3,7.7,7.1,6.7,6.3])),a=t._(a).concat(t._([12.5,11.1,9.1,5.9,5.6,5.3])),o=t._(o).concat(t._([100,50,33.3,25,20])));var n=[{count:6,pool:e},{count:3,pool:a},{count:1,pool:o}],i=[];n.forEach(function(t){for(var e=0;e<t.count;e++){var a=Math.floor(Math.random()*t.pool.length);i.push(t.pool[a])}});for(var r=i.length-1;r>0;r--){var s,u=Math.floor(Math.random()*(r+1));s=[i[u],i[r]],i[r]=s[0],i[u]=s[1]}for(var d=!1,h=0;!d&&h<100;){h++,d=!0;for(var c={},l=0;l<i.length;l++){var f=i[l];if(c[f]=(c[f]||0)+1,c[f]>2||l>0&&i[l]===i[l-1]){d=!1;break}}if(!d){i=[],n.forEach(function(t){for(var e=[],a=0;a<t.count;a++)!function(){var a=void 0,o=10;do{var n=Math.floor(Math.random()*t.pool.length);if(a=t.pool[n],e.filter(function(t){return t===a}).length<2)break;o--}while(o>0);e.push(a),i.push(a)}()});for(var p=i.length-1;p>0;p--){var g,m=Math.floor(Math.random()*(p+1));g=[i[m],i[p]],i[p]=g[0],i[m]=g[1]}}}for(var v=1;v<i.length;v++)if(i[v]===i[v-1]){var w,D=(v+1)%i.length;w=[i[D],i[v]],i[v]=w[0],i[D]=w[1]}this.setData({questionQueue:i})},getQuestionPool:function(){var t={6:10,7:10,12:10,13:10,14:10,15:10,16:10,8:6,9:6,17:6,18:6,19:6,2:1,3:1,4:1,5:1,10:1,11:1},e=[];return Object.keys(t).forEach(function(a){for(var o=t[a],n=parseInt(a),i=0;i<o;i++)e.push(n)}),"reverse"===this.data.mode&&[{p:1,d:100},{p:2,d:50},{p:3,d:33.3},{p:4,d:25},{p:5,d:20},{p:6,d:16.7},{p:7,d:14.3},{p:8,d:12.5},{p:9,d:11.1},{p:10,d:10},{p:11,d:9.1},{p:12,d:8.3},{p:13,d:7.7},{p:14,d:7.1},{p:15,d:6.7},{p:16,d:6.3},{p:17,d:5.9},{p:18,d:5.6},{p:19,d:5.3},{p:20,d:5}].forEach(function(t){e.push(t.d),e.push(t.d)}),e},startTimer:function(){var t=this;this.stopTimer(),this.setData({isRunning:!0}),this.data.timer=setInterval(function(){var e=Math.floor((Date.now()-t.data.startTime)/1e3),a=Math.floor(e/60).toString().padStart(2,"0"),o=(e%60).toString().padStart(2,"0");t.setData({timeString:"".concat(a,":").concat(o)})},1e3)},stopTimer:function(){this.data.timer&&(clearInterval(this.data.timer),this.data.timer=null),this.setData({isRunning:!1})},nextQuestion:function(){if(this.data.questionQueue&&this.data.questionQueue.length>0){var e,a=t._(this.data.questionQueue),o=a.shift();this.setData({questionQueue:a}),this.setQuestionData(o);return}for(var n=this.getQuestionPool(),i=20;;){var r=Math.floor(Math.random()*n.length);if(e=n[r],i--,!(this.data.logs.length>0)||this.data.logs[0].d!==e||!(i>0))break}this.setQuestionData(e)},setQuestionData:function(t){if("forward"===this.data.mode)Number.isInteger(t)||(t=Math.round(t)),this.setData({denominator:t,question:"1 / ".concat(t),inputValue:""});else{var e,a=100/t,o={100:"1",50:"2",33.3:"3",25:"4",20:"5",16.7:"6",14.3:"7",12.5:"8",11.1:"9",10:"10",9.1:"11",8.3:"12",7.7:"13",7.1:"14",6.7:"15",6.3:"16",5.9:"17",5.6:"18",5.3:"19",5:"20"};o[t]?e=o[t]:Number.isInteger(a)?e=a.toString():(e=a.toFixed(1)).endsWith(".0")&&(e=e.slice(0,-2)),this.setData({denominator:t,questionPercentage:e,question:"".concat(e,"%"),inputValue:""})}},onKeyTap:function(t){var e=t.currentTarget.dataset.key;if(e){var a=Date.now();if(!this.lastTapTime||!(a-this.lastTapTime<5)){this.lastTapTime=a;var o=this.data.inputValue;"del"===e?o=o.slice(0,-1):"clear"===e?o="":"."===e?o.includes(".")||(o+=e):o.length<6&&(o+=e),this.setData({inputValue:o})}}},onSubmit:function(){if(this.data.inputValue){var e=parseFloat(this.data.inputValue),a=!1,o="";if("forward"===this.data.mode){var n=100/this.data.denominator,i=parseFloat(n.toFixed(3));a=.02>=Math.abs((e-i)/i),o=n.toFixed(1)}else{var r=this.data.denominator;a=.02>=Math.abs((e-r)/r),o=r.toString()}var s=[{id:Date.now(),d:this.data.denominator,q:"forward"===this.data.mode?"1/".concat(this.data.denominator):"".concat(this.data.questionPercentage,"%"),u:"forward"===this.data.mode?e:"1/".concat(e),real:"forward"===this.data.mode?o:"1/".concat(o),correct:a}].concat(t._(this.data.logs)),u=this.data.totalCount+1,d=a?this.data.correctCount+1:this.data.correctCount;if(this.setData({logs:s,totalCount:u,correctCount:d}),u>=10){this.stopTimer(),this.setData({question:"",inputValue:"",questionPercentage:"",isFinished:!0});var h={logs:t._(s).reverse(),timeString:this.data.timeString};wx.setStorageSync("percentageResult",h),wx.redirectTo({url:"/pages/percentage-result/percentage-result",fail:function(t){console.error("Redirect failed:",t),wx.reLaunch({url:"/pages/percentage-result/percentage-result"})}});return}this.nextQuestion()}}}); 
 			}); 	require("pages/math-tools/percentage/percentage.js");
 		__wxRoute = 'pages/percentage-result/percentage-result';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/percentage-result/percentage-result.js';	define("pages/percentage-result/percentage-result.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Page({data:{logs:[],timeString:"",score:0},onLoad:function(t){var e=wx.getStorageSync("percentageResult");if(e){var n=e.logs,r=e.timeString,o=n.filter(function(t){return t.correct}).length,a=n.length>0?(o/n.length*100).toFixed(0):0;this.setData({logs:n,timeString:r,score:a})}},onBack:function(){wx.navigateBack()},onRetry:function(){wx.redirectTo({url:"/pages/math-tools/percentage/percentage"})}}); 
 			}); 	require("pages/percentage-result/percentage-result.js");
 		__wxRoute = 'pages/fb-tool/fb-tool';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/fb-tool/fb-tool.js';	define("pages/fb-tool/fb-tool.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";var t="https://cloud1-8g137o5da8d5e269-1388442749.tcloudbaseapp.com/fenbi/install.html";Page({data:{guideUrl:t,pricing:[{t:"\uD83C\uDF81 完全免费",d:"当前版本免费开放：无需卡密、无需试用次数，打开即可直接使用全部功能。"}]},onCopyGuide:function(){var i=this,o=0,a=function(){o++,wx.setClipboardData({data:t,success:function(){wx.getClipboardData({success:function(o){o.data===t?wx.showToast({title:"网址已复制，去电脑浏览器粘贴打开",icon:"none",duration:2600}):i.copyFailTip()},fail:function(){wx.showToast({title:"网址已复制",icon:"success"})}})},fail:function(){o<3?setTimeout(a,300):i.copyFailTip()}})};a()},copyFailTip:function(){wx.showModal({title:"复制失败",content:"请长按上方网址文字，手动选择复制",showCancel:!1,confirmText:"知道了"})}}); 
 			}); 	require("pages/fb-tool/fb-tool.js");
 		__wxRoute = 'pages/idiom/idiom';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/idiom/idiom.js';	define("pages/idiom/idiom.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e=require("../../@swc/runtime/_async_to_generator"),t=require("../../@swc/runtime/_ts_generator"),r=[{key:"people",name:"人民网",short:"民",cls:"people",desc:"人民网 \xb7 搜索平台"},{key:"rmrb",name:"人民日报",short:"日",cls:"rmrb",desc:"人民日报 \xb7 电子报全文检索"},{key:"gmw",name:"光明网",short:"光",cls:"gmw",desc:"光明网 \xb7 光明日报新闻搜索"},{key:"d71",name:"党建先锋",short:"党",cls:"d71",desc:"12371 党建先锋 \xb7 新闻搜索"}];Page({data:{keyword:"",hots:["踔厉奋发","笃行不怠","绿水青山"],loading:!1,error:"",searchedWord:"",sites:[]},onLoad:function(){},onInput:function(e){this.setData({keyword:e.detail.value})},onHotTap:function(e){var t=e.currentTarget.dataset.q;t&&(this.setData({keyword:t}),this.doSearch(t))},onSearch:function(){this.doSearch(this.data.keyword)},doSearch:function(n){return e._(function(){var e,a,s,o,i,c,l;return t._(this,function(t){switch(t.label){case 0:if(!(n=(n||"").trim()))return this.setData({error:"请输入一个成语，如：踔厉奋发"}),[2];try{if(e="idiom_cache_"+n,(a=wx.getStorageSync(e))&&a.ts&&Date.now()-a.ts<36e5&&a.sites&&a.sites.length)return this.setData({searchedWord:n,sites:a.sites,error:""}),[2]}catch(e){}this.setData({loading:!0,error:"",searchedWord:n,sites:[]}),t.label=1;case 1:return t.trys.push([1,3,,4]),[4,wx.cloud.callFunction({name:"idiomSearch",data:{q:n}})];case 2:if(!(o=(s=t.sent())&&s.result)||!o.ok||!o.data)throw Error(o&&o.error||"检索失败");i=o.data,c=r.filter(function(e){return i[e.key]}).map(function(e){var t=i[e.key],r=t.examples||[],a=r.length&&r.length<5?"⚠ 去重后仅找到 "+r.length+" 条不同例句（已翻页检索 "+(t.scanned||0)+" 篇，其余为相同句子的转载或重复）":"";return{key:e.key,name:e.name,short:e.short,cls:e.cls,desc:e.desc,total:t.total||0,count:r.length,scanned:t.scanned||0,note:a,examples:r.map(function(e,t){return{url:e.url,sentence:e.sentence,source:e.source,time:e.time,title:e.title||"",nodes:function(e,t,r){var n=[];if(r&&n.push({name:"span",attrs:{style:"display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#eef1f6;color:#9aa1ab;font-size:12px;font-weight:700;margin-right:10px;vertical-align:2px;"},children:[{type:"text",text:String(r)}]}),!t)return n.push({type:"text",text:String(e||"")}),n;for(var a=String(e||""),s=a.toLowerCase(),o=String(t).toLowerCase(),i=0;;){var c=s.indexOf(o,i);if(-1===c){n.push({type:"text",text:a.slice(i)});break}c>i&&n.push({type:"text",text:a.slice(i,c)}),n.push({name:"span",attrs:{style:"color:#c8102e;background:#fff3b0;font-weight:700"},children:[{type:"text",text:a.slice(c,c+t.length)}]}),i=c+t.length}return n}(e.sentence,n,t+1)}})}}),this.setData({loading:!1,sites:c});try{wx.setStorageSync("idiom_cache_"+n,{ts:Date.now(),sites:c})}catch(e){}return[3,4];case 3:return console.error("[idiom] search error",l=t.sent()),this.setData({loading:!1,error:"检索失败："+(l&&l.message||"网络异常")+"（可稍后重试）"}),[3,4];case 4:return[2]}})}).call(this)},onExampleTap:function(e){var t=e.currentTarget.dataset,r=t.url,n=t.word;r&&wx.navigateTo({url:"/pages/idiom-reader/idiom-reader?url="+encodeURIComponent(r)+"&q="+encodeURIComponent(n||"")})}}); 
 			}); 	require("pages/idiom/idiom.js");
 		__wxRoute = 'pages/idiom-reader/idiom-reader';__wxRouteBegin = true; 	__wxAppCurrentFile__ = 'pages/idiom-reader/idiom-reader.js';	define("pages/idiom-reader/idiom-reader.js", function(require, module, exports, window,document,frames,self,location,navigator,localStorage,history,Caches,screen,alert,confirm,prompt,XMLHttpRequest,WebSocket,Reporter,webkit,WeixinJSCore){ 			
"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var t=require("../../@swc/runtime/_async_to_generator"),e=require("../../@swc/runtime/_ts_generator");Page({data:{url:"",q:"",loading:!0,loadingText:"正在加载正文…",error:"",mode:"text",title:"",html:"",encoding:"utf-8",paragraphs:[]},onLoad:function(t){var e=decodeURIComponent(t.url||""),r=decodeURIComponent(t.q||"");this.setData({url:e,q:r}),this.loadText(e,r)},loadText:function(r,a){return t._(function(){var t,n,i,o;return e._(this,function(e){switch(e.label){case 0:if(!r)return this.setData({loading:!1,error:"缺少文章链接"}),[2];this.setData({loading:!0,loadingText:"正在加载正文…",error:""}),e.label=1;case 1:return e.trys.push([1,3,,4]),[4,wx.cloud.callFunction({name:"idiomSearch",data:{url:r,q:a}})];case 2:if(!(n=(t=e.sent())&&t.result)||!n.ok||!n.data)throw Error(n&&n.error||"加载失败");return o=((i=n.data).paragraphs||[]).map(function(t){return{text:t,nodes:function(t,e){var r=[];if(!e)return r.push({type:"text",text:String(t||"")}),r;for(var a=String(t||""),n=a.toLowerCase(),i=String(e).toLowerCase(),o=0;;){var s=n.indexOf(i,o);if(-1===s){r.push({type:"text",text:a.slice(o)});break}s>o&&r.push({type:"text",text:a.slice(o,s)}),r.push({name:"span",attrs:{style:"color:#c8102e;background:#fff3b0;font-weight:700"},children:[{type:"text",text:a.slice(s,s+e.length)}]}),o=s+e.length}return r}(t,a)}}),this.setData({loading:!1,mode:"text",title:i.title||"无标题",encoding:i.encoding||"utf-8",paragraphs:o}),[3,4];case 3:return console.error("[idiom-reader] text error",e.sent()),this.setData({loading:!1,error:"正文加载失败，请检查网络后重试"}),[3,4];case 4:return[2]}})}).call(this)},onViewOriginal:function(){return t._(function(){var t,r,a;return e._(this,function(e){switch(e.label){case 0:if(t=this,"html"===this.data.mode)return[2];if(this.data.html)return this.setData({mode:"html",error:""}),[2];this.setData({loading:!0,loadingText:"正在加载原网页图文版…（图片较多需几秒）",error:""}),e.label=1;case 1:return e.trys.push([1,3,,4]),[4,wx.cloud.callFunction({name:"idiomSearch",data:{url:this.data.url,q:this.data.q,raw:!0}})];case 2:if(!(a=(r=e.sent())&&r.result)||!a.ok||!a.data||!a.data.html||String(a.data.html).length<300)throw Error(a&&a.error||"提取失败");return this.setData({loading:!1,mode:"html",title:a.data.title||this.data.title||"无标题",html:String(a.data.html||"").replace(/<(h1|h2|h3|h4|p|div|span|em|strong)([^>]*?)>/gi,function(t,e,r){var a=r||"",n="";return("h1"===e?n="text-align:center;font-size:26px;line-height:1.7;font-weight:bold;color:#333;margin:0 0 14px;":"h2"===e||"h3"===e||"h4"===e?n="font-weight:bold;font-size:18px;line-height:1.8;margin:18px 0 8px;color:#26292e;":"p"===e?n="font-size:17px;line-height:2;color:#26292e;margin:0 0 1.2em;text-align:justify;word-break:break-word;":"div"===e&&(n="font-size:17px;line-height:2;color:#26292e;"),/class\s*=\s*["'][^"']*(author|info|time|date|source|copyright|intro|meta|ftitle|fline|bc_)[^"']*["']/i.test(a)&&(n+="text-align:center;color:#666;font-size:14px;line-height:1.8;"),n)?"<"+e+(a=a.replace(/\sstyle\s*=\s*["'][^"']*["']/gi,""))+' style="'+n+'">':t}).replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi,function(t,e,r){var a=String(r||"").replace(/<[^>]+>/g,"").trim();if(!(/^\d{4}年\d{1,2}月\d{1,2}日/.test(a)||/^来源[:：]/.test(a)||/^\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}/.test(a)||/^[\u4e00-\u9fa5·]{2,4}$/.test(a)&&a.length>=2))return t;var n=e||"";return"<p"+(n=n.replace(/\sstyle\s*=\s*["'][^"']*["']/gi,""))+' style="text-align:center;color:#666;font-size:14px;line-height:1.8;margin:0 0 10px;">'+r+"</p>"})}),[3,4];case 3:return console.error("[idiom-reader] raw error",e.sent()),this.setData({loading:!1,mode:"text"}),wx.showModal({title:"原网页图文版加载失败",content:"该页面可能暂不支持图文提取。可复制原文链接，在手机浏览器中打开查看。",confirmText:"复制链接",cancelText:"返回",success:function(e){e.confirm&&t.onCopyLink()}}),[3,4];case 4:return[2]}})}).call(this)},onBackToText:function(){this.setData({mode:"text"})},onRetry:function(){"html"===this.data.mode?(this.setData({mode:"text",loading:!1,error:""}),this.onViewOriginal()):this.loadText(this.data.url,this.data.q)},onBack:function(){wx.navigateBack()},onCopyLink:function(){wx.setClipboardData({data:this.data.url,success:function(){wx.showToast({title:"原文链接已复制，请去浏览器粘贴打开",icon:"none",duration:2400})}})}}); 
 			}); 	require("pages/idiom-reader/idiom-reader.js");
 	
const VERSION = require('../package.json').version;
const md5 = require('blueimp-md5');
const marked = require('marked');
const autosize = require('autosize');
const timeAgo = require('./utils/timeago');
const detect = require('./utils/detect');
const Utils = require('./utils/domUtils');
const Emoji = require('./plugins/emojis');
const hanabi = require('hanabi');
const fetch = require('node-fetch')
const APIURL = '/api/comment/';
const CHILDAPIURL = '/api/childcomment/';
const defaultComment = {
    comment: '',
    nick: '匿名',
    mail: '',
    link: '',
    ua: navigator.userAgent,
    url: ''
};
const locales = {
    'zh-cn': {
        head: {
            nick: '昵称',
            mail: '邮箱',
            link: '博客(http://)',
        },
        tips: {
            comments: '评论',
            sofa: '快来做第一个评论的人吧😃',
            busy: '还在提交中，请稍候😅',
            again: '这么简单也能错，也是没谁了🙄'
        },
        ctrl: {
            reply: '回复',
            ok: '好的',
            sure: '确认',
            cancel: '取消',
            confirm: '确认',
            continue: '继续',
            more: '查看更多...',
            try: '再试试?',
            preview: '预览',
            emoji: '表情'
        },
        error: {
            99: '初始化失败，请检查init中的`el`元素.',
            100: '初始化失败.',
            401: '未经授权的操作.',
            403: '访问被api域名白名单拒绝，请检查你的安全域名设置.',
        },
        timeago: {
            seconds: '秒前',
            minutes: '分钟前',
            hours: '小时前',
            days: '天前',
            now: '刚刚'
        }
    },
    en: {
        head: {
            nick: 'NickName',
            mail: 'E-Mail',
            link: 'Website(http://)',
        },
        tips: {
            comments: 'Comments',
            sofa: 'No comments yet.',
            busy: 'Submit is busy, please wait...',
            again: 'Sorry, this is a wrong calculation.'
        },
        ctrl: {
            reply: 'Reply',
            ok: 'Ok',
            sure: 'Sure',
            cancel: 'Cancel',
            confirm: 'Confirm',
            continue: 'Continue',
            more: 'Load More...',
            try: 'Once More?',
            preview: 'Preview',
            emoji: 'Emoji'
        },
        error: {
            99: 'Initialization failed, Please check the `el` element in the init method.',
            100: 'Initialization failed.',
            401: 'Unauthorized operation.',
            403: 'Access denied by api domain white list, Please check your security domain.',
        },
        timeago: {
            seconds: 'seconds ago',
            minutes: 'minutes ago',
            hours: 'hours ago',
            days: 'days ago',
            now: 'just now'
        }
    }
}

class Comment {}

// gravatar 头像
let _avatarSetting = {
        cdn: 'https://gravatar.loli.net/avatar/',
        ds: ['mp', 'identicon', 'monsterid', 'wavatar', 'robohash', 'retro', ''],
        params: '',
        hide: false
    },
    META = ['nick', 'mail', 'link'],
    _store = Storage && localStorage && localStorage instanceof Storage && localStorage;

function ValineFactory(option) {
    let root = this;
    root.init(option);
    // Valine init
    return root;
}

/**
 * Valine Init
 */
ValineFactory.prototype.init = function (option) {
    let root = this;
    root['config'] = option
    if (typeof document === 'undefined') {
        console && console.warn('Sorry, Valine does not support Server-side rendering.')
        return;
    }
    !!option && root._init();
    return root;
}

ValineFactory.prototype._init = function(){
    let root = this;
    try {
        let {
            lang,
            langMode,
            avatar,
            avatarForce,
            avatar_cdn,
            notify,
            verify,  // 验证是人
            visitor,  // gravatar
            path = location.pathname,  // URL path
            pageSize,
            recordIP,
        } = root.config;
        root['config']['path'] = path.replace(/index\.html?$/, '');
        let ds = _avatarSetting['ds'];
        let force = avatarForce ? '&q=' + Math.random().toString(32).substring(2) : '';
        lang && langMode && root.installLocale(lang, langMode);
        root.locale = root.locale || locales[lang || 'zh-cn'];
        root.notify = notify || true;
        root.verify = verify || false;
        _avatarSetting['params'] = `?d=${(ds.indexOf(avatar) > -1 ? avatar : 'mp')}&v=${VERSION}${force}`;
        _avatarSetting['hide'] = avatar === 'hide';
        _avatarSetting['cdn'] = /^https?\:\/\//.test(avatar_cdn) ? avatar_cdn : _avatarSetting['cdn']

        let size = Number(pageSize || 10);
        root.config.pageSize = !isNaN(size) ? (size < 1 ? 10 : size) : 10;

        marked.setOptions({
            renderer: new marked.Renderer(),
            highlight: root.config.highlight === false ? null : hanabi,
            gfm: true,
            tables: true,
            breaks: true,
            pedantic: false,
            sanitize: true,
            smartLists: true,
            smartypants: true
        });


        if (recordIP) {
            let ipScript = Utils.create('script', 'src', '//api.ip.sb/jsonip?callback=getIP');
            let s = document.getElementsByTagName("script")[0];
            s.parentNode.insertBefore(ipScript, s);
            // 获取IP
            window.getIP = function (json) {
                defaultComment['ip'] = json.ip;
            }
        }

        // 获取在 post meta 显示的评论数
        let els = Utils.findAll(document, '.valine-comment-count');
        Utils.each(els, (idx, el) => {
            if (el) {
                let k = Utils.attr(el, 'data-xid');
                if (k) {
                    fetch(APIURL+'?url='+decodeURI(k))
                        .then(rets => rets.json())
                        .then(json => Object.keys(json).length)
                        .then(n => {
                            el.innerText = n
                        }).catch(ex => {
                        el.innerText = 0
                    })
                }
            }
        })

        // post 阅读量
        // visitor && CounterFactory.add(AV.Object.extend('Counter'),root.config.path);


        let el = root.config.el || null;
        let _el = Utils.findAll(document, el);
        el = el instanceof HTMLElement ? el : (_el[_el.length - 1] || null);
        if (!el) return;
        root.el = el;
        // 添加类
        try{root.el.classList.add('v');}catch(ex){root.el.setAttribute('class',root.el.getAttribute('class')+' v')}

        // gravatar
        _avatarSetting['hide'] && root.el.classList.add('hide-avatar');
        root.config.meta = (root.config.guest_info || root.config.meta || META).filter(item => META.indexOf(item) > -1);
        let inputEl = (root.config.meta.length == 0 ? META : root.config.meta).map(item => {
            let _t = item == 'mail' ? 'email' : 'text';
            return META.indexOf(item) > -1 ? `<input name="${item}" placeholder="${root.locale['head'][item]}" class="v${item} vinput" type="${_t}">` : ''
        });
        root.placeholder = root.config.placeholder || 'Just Go Go';

        // 插入评论 HTML
        root.el.innerHTML = `<div class="vwrap"><div class="${`vheader item${inputEl.length}`}">${inputEl.join('')}</div><div class="vedit"><textarea id="veditor" class="veditor vinput" placeholder="${root.placeholder}"></textarea><div class="vctrl"><span class="vemoji-btn">${root.locale['ctrl']['emoji']}</span> | <span class="vpreview-btn">${root.locale['ctrl']['preview']}</span></div><div class="vemojis" style="display:none;"></div><div class="vinput vpreview" style="display:none;"></div></div><div class="vcontrol"><div class="col col-20" title="Markdown is supported"><a href="https://segmentfault.com/markdown" target="_blank"><svg class="markdown" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15v-7.7C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.92 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z"></path></svg></a></div><div class="col col-80 text-right"><button type="button" title="Cmd|Ctrl+Enter" class="vsubmit vbtn">${root.locale['ctrl']['reply']}</button></div></div><div style="display:none;" class="vmark"></div></div><div class="vinfo" style="display:none;"><div class="vcount col"></div></div><div class="vlist"></div><div class="vempty" style="display:none;"></div><div class="vpage txt-center"></div></div>`;


        // 没有评论则显示 .vempty，显示 sofa 写好的语句
        // 后面应该是接着插入一些加载显示模块
        let vempty = Utils.find(root.el, '.vempty');
        root.nodata = {
            show(txt) {
                vempty.innerHTML = txt || root.locale['tips']['sofa'];
                Utils.attr(vempty, 'style', 'display:block;');
                return root;
            },
            hide() {
                Utils.attr(vempty, 'style', 'display:none;');
                return root;
            }
        }
        // loading
        let _spinner = Utils.create('div', 'class', 'vloading');
        // loading control
        let _vlist = Utils.find(root.el, '.vlist');
        root.loading = {
            show(mt) {
                let _vlis = Utils.findAll(_vlist, '.vcard');
                if (mt) _vlist.insertBefore(_spinner, _vlis[0]);
                else _vlist.appendChild(_spinner);
                root.nodata.hide();
                return root;
            },
            hide() {
                let _loading = Utils.find(_vlist, '.vloading');
                if (_loading) Utils.remove(_loading);
                Utils.findAll(_vlist, '.vcard').length === 0 && root.nodata.show()
                return root;
            }
        };
        // alert
        let _mark = Utils.find(root.el, '.vmark');
        root.alert = {
            /**
             * {
             *  type:0/1,
             *  text:'',
             *  ctxt:'',
             *  otxt:'',
             *  cb:fn
             * }
             *
             * @param {Object} o
             */
            show(o) {
                _mark.innerHTML = `<div class="valert txt-center"><div class="vtext">${o && o.text || 1}</div><div class="vbtns"></div></div>`;
                let _vbtns = Utils.find(_mark, '.vbtns');
                let _cBtn = `<button class="vcancel vbtn">${ o && o.ctxt || root.locale['ctrl']['cancel'] }</button>`;
                // let _oBtn = `<button class="vsure vbtn">${ o && o.otxt || root.locale['ctrl']['sure'] }</button>`;
                // _vbtns.innerHTML = `${_cBtn}${o && o.type && _oBtn}`;
                _vbtns.innerHTML = `${_cBtn}`;
                Utils.on('click', Utils.find(_mark, '.vcancel'), (e) => {
                    root.alert.hide();
                })
                Utils.attr(_mark, 'style', 'display:block;');
                // if (o && o.type) {
                //     let _ok = Utils.find(_mark, '.vsure');
                //     Utils.on('click', _ok, (e) => {
                //         root.alert.hide();
                //         o.cb && o.cb();
                //     });
                // }
                return root;
            },
            hide() {
                Utils.attr(_mark, 'style', 'display:none;');
                return root;
            }
        }

        // Bind Event
        root.bind();

    } catch (ex) {
        root.ErrorHandler(ex,'init')
    }
}

// 新建 post Counter 对象
// let createCounter = function (Counter, o) {
//     let newCounter = new Counter();
//     let acl = new AV.ACL();
//     acl.setPublicReadAccess(true);
//     acl.setPublicWriteAccess(true);
//     newCounter.setACL(acl);
//     newCounter.set('url', o.url)
//     newCounter.set('xid', o.xid)
//     newCounter.set('title', o.title)
//     newCounter.set('time', 1)
//     newCounter.save().then(ret => {
//         Utils.find(o.el, '.leancloud-visitors-count').innerText = 1
//     }).catch(ex => {
//         console.log(ex)
//     });
// }
// let CounterFactory = {
//     add(Counter,currPath) {
//         let root = this
//         let lvs = Utils.findAll(document, '.leancloud_visitors,.leancloud-visitors');
//         if (lvs.length) {
//             let lv = lvs[0];
//             let url = Utils.attr(lv, 'id');
//             let title = Utils.attr(lv, 'data-flag-title');
//             let xid = encodeURI(url);
//             let o = {
//                 el: lv,
//                 url: url,
//                 xid: xid,
//                 title: title
//             }
//             // 判断是否需要+1
//             if (decodeURI(url) === decodeURI(currPath)) {
//                 let query = new AV.Query(Counter);
//                 query.equalTo('url', url);
//                 query.find().then(ret => {
//                     if (ret.length > 0) {
//                         let v = ret[0];
//                         v.increment("time");
//                         v.save().then(rt => {
//                             Utils.find(lv, '.leancloud-visitors-count').innerText = rt.get('time')
//                         }).catch(ex => {
//                             console.log(ex)
//                         });
//                     } else {
//                         createCounter(Counter, o)
//                     }
//                 }).catch(ex => {
//                     ex.code == 101 && createCounter(Counter, o)
//                 })
//             } else CounterFactory.show(Counter, lvs)
//         }
//     },
//     show(Counter, lvs) {
//         let COUNT_CONTAINER_REF = '.leancloud-visitors-count';

//         // 重置所有计数
//         Utils.each(lvs, (idx, el) => {
//             let cel = Utils.find(el, COUNT_CONTAINER_REF);
//             if (cel) cel.innerText = 0
//         })
//         let urls = [];
//         for (let i in lvs) {
//             if (lvs.hasOwnProperty(i)) urls.push(Utils.attr(lvs[i], 'id'))
//         }
//         if (urls.length) {
//             let query = new AV.Query(Counter);
//             query.containedIn('url', urls);
//             query.find().then(ret => {
//                 if (ret.length > 0) {
//                     Utils.each(ret, (idx, item) => {
//                         let url = item.get('url');
//                         let time = item.get('time');
//                         let els = Utils.findAll(document, `.leancloud_visitors[id="${url}"],.leancloud-visitors[id="${url}"]`);
//                         Utils.each(els, (idx, el) => {
//                             let cel = Utils.find(el, COUNT_CONTAINER_REF);
//                             if (cel) cel.innerText = time
//                         })
//                     });
//                 }
//             }).catch(ex => {
//                 console.error(ex)
//             })
//         }
//     }
// }


ValineFactory.prototype.ErrorHandler = function (ex,origin) {
    console.log(origin)
    console.error(ex)
    console.error(ex.code,ex.message)
    let root = this;
    root.el && root.loading.hide().nodata.hide()
    if (({}).toString.call(ex) === "[object Error]") {
        let code = ex.code || '',
            t = root.locale['error'][code],
            msg = t || ex.message || ex.error || '';
        if (code == 101) root.nodata.show()
        else root.el && root.nodata.show(`<pre style="text-align:left;">Code ${code}: ${msg}</pre>`) ||
        console && console.error(`Code ${code}: ${msg}`)
    } else {
        root.el && root.nodata.show(`<pre style="text-align:left;">${JSON.stringify(ex)}</pre>`) ||
        console && console.error(JSON.stringify(ex))
    }
    return;
}

/**
 * install Multi language support
 * @param {String} locale langName
 * @param {Object} mode langSource
 */
ValineFactory.prototype.installLocale = function (locale, mode) {
    let root = this;
    mode = mode || {};
    if (locale) {
        // locales[locale] = JSON.stringify(Object.keys(locales['zh-cn']))==JSON.stringify(Object.keys(mode)) ? mode : undefined;
        locales[locale] = mode;
        root.locale = locales[locale] || locales['zh-cn'];
    }
    return root;
}

/**
 *
 * @param {String} path
 */
ValineFactory.prototype.setPath = function (path) {
    this.config.path = path
    return this
}

/**
 * Bind Event
 */
ValineFactory.prototype.bind = function (option) {
    let root = this;

    // load emojis
    let _vemojis = Utils.find(root.el, '.vemojis');
    let _vpreview = Utils.find(root.el, '.vpreview');
    // emoji 操作
    let _emojiCtrl = Utils.find(root.el, '.vemoji-btn');
    // 评论内容预览
    let _vpreviewCtrl = Utils.find(root.el, `.vpreview-btn`);
    let _veditor = Utils.find(root.el, '.veditor');
    let emojiData = Emoji.data;
    for (let key in emojiData) {
        if (emojiData.hasOwnProperty(key)) {
            (function (name, val) {
                let _i = Utils.create('i', {
                    'name': name,
                    'title': name
                });
                _i.innerHTML = val;
                _vemojis.appendChild(_i);
                Utils.on('click', _i, (e) => {
                    _insertAtCaret(_veditor, val)
                    syncContentEvt(_veditor)
                });
            })(key, emojiData[key])
        }
    }

    root.emoji = {
        show() {
            root.preview.hide();
            Utils.attr(_emojiCtrl, 'v', 1);
            Utils.removeAttr(_vpreviewCtrl, 'v');
            Utils.attr(_vemojis, 'style', 'display:block');
            return root.emoji
        },
        hide() {
            Utils.removeAttr(_emojiCtrl, 'v');
            Utils.attr(_vemojis, 'style', 'display:hide');
            return root.emoji
        }
    }
    root.preview = {
        show() {
            if (defaultComment['comment']) {
                root.emoji.hide();
                Utils.attr(_vpreviewCtrl, 'v', 1);
                Utils.removeAttr(_emojiCtrl, 'v');
                _vpreview.innerHTML = defaultComment['comment'];
                Utils.attr(_vpreview, 'style', 'display:block');
                _activeOtherFn()
            }
            return root.preview
        },
        hide() {
            Utils.removeAttr(_vpreviewCtrl, 'v');
            Utils.attr(_vpreview, 'style', 'display:none');
            return root.preview
        },
        empty() {
            _vpreview.innerHtml = '';
            return root.preview
        }
    }

    /**
     * XSS filter
     * @param {String} content Html String
     */
    let xssFilter = (content) => {
        let vNode = Utils.create('div');
        vNode.insertAdjacentHTML('afterbegin', content);
        let ns = Utils.findAll(vNode, "*");
        let rejectNodes = ['INPUT', 'STYLE', 'SCRIPT', 'IFRAME', 'FRAME', 'AUDIO', 'VIDEO', 'EMBED', 'META', 'TITLE', 'LINK'];
        let __replaceVal = (node, attr) => {
            let val = Utils.attr(node, attr);
            val && Utils.attr(node, attr, val.replace(/(javascript|eval)/ig, ''));
        }
        Utils.each(ns, (idx, n) => {
            if (n.nodeType !== 1) return;
            if (rejectNodes.indexOf(n.nodeName) > -1) {
                if (n.nodeName === 'INPUT' && Utils.attr(n, 'type') === 'checkbox') Utils.attr(n, 'disabled', 'disabled');
                else Utils.remove(n);
            }
            if (n.nodeName === 'A') __replaceVal(n, 'href')
            Utils.clearAttr(n)
        })

        return vNode.innerHTML
    }

    /**
     * 评论框内容变化事件
     * @param {HTMLElement} el
     */
    let syncContentEvt = (_el) => {
        let _v = 'comment';
        let _val = (_el.value || '');
        _val = Emoji.parse(_val);
        _el.value = _val;
        let ret = xssFilter(marked(_val));
        defaultComment[_v] = ret;
        _vpreview.innerHTML = ret;
        if (_val) autosize(_el);
        else autosize.destroy(_el)
    }

    // 显示/隐藏 Emojis
    Utils.on('click', _emojiCtrl, (e) => {
        let _vi = Utils.attr(_emojiCtrl, 'v');
        if (_vi) root.emoji.hide()
        else root.emoji.show();
    });

    // 显示/隐藏预览
    Utils.on('click', _vpreviewCtrl, function (e) {
        let _vi = Utils.attr(_vpreviewCtrl, 'v');
        if (_vi) root.preview.hide();
        else root.preview.show();
    });

    let meta = root.config.meta;
    let inputs = {};

    // 同步操作
    let mapping = {
        veditor: "comment"
    }
    for (let i = 0, len = meta.length; i < len; i++) {
        mapping[`v${meta[i]}`] = meta[i];
    }
    for (let i in mapping) {
        if (mapping.hasOwnProperty(i)) {
            let _v = mapping[i];
            let _el = Utils.find(root.el, `.${i}`);
            inputs[_v] = _el;
            _el && Utils.on('input change blur', _el, (e) => {
                if (_v === 'comment') syncContentEvt(_el)
                else defaultComment[_v] = Utils.escape(_el.value.replace(/(^\s*)|(\s*$)/g, ""));
            });
        }
    }

    let _insertAtCaret = (field, val) => {
        if (document.selection) {
            //For browsers like Internet Explorer
            field.focus();
            let sel = document.selection.createRange();
            sel.text = val;
            field.focus();
        } else if (field.selectionStart || field.selectionStart == '0') {
            //For browsers like Firefox and Webkit based
            let startPos = field.selectionStart;
            let endPos = field.selectionEnd;
            let scrollTop = field.scrollTop;
            field.value = field.value.substring(0, startPos) + val + field.value.substring(endPos, field.value.length);
            field.focus();
            field.selectionStart = startPos + val.length;
            field.selectionEnd = startPos + val.length;
            field.scrollTop = scrollTop;
        } else {
            field.focus();
            field.value += val;
        }
    }

    let createVquote = id => {
        let vcontent = Utils.find(root.el, ".vh[rootid='" + id + "']");
        let vquote = Utils.find(vcontent, '.vquote');
        if (!vquote) {
            vquote = Utils.create('div', 'class', 'vquote');
            vcontent.appendChild(vquote);
        }
        return vquote
    }

    let query = (page = 1) => {
        let pageSize = root.config.pageSize;
        let count = Number(Utils.find(root.el, '.vnum').innerText);
        root.loading.show();
        fetch(APIURL+'?url='+decodeURI(root.config.path)+'&page='+page+'&page_size='+pageSize+'&ordering=ctime')
            .then(rets => rets.json())
            .then(retJsons => {
                let len = Object.keys(retJsons).length;
                for (let i = 0; i < len; i++) {
                    let retJson = retJsons[i];
                    // rids.push(retJson.id)
                    insertDom(retJson, Utils.find(root.el, '.vlist'), !0);
                }
                // load children comment
                fetch(CHILDAPIURL+'?url='+decodeURI(root.config.path)+'&ordering=-ctime')
                    .then(retChilds => retChilds.json())
                    .then(retChildsJson => {
                        let childsLen = Object.keys(retChildsJson).length
                        for (let j = 0; j < childsLen; j++) {
                            let retChildJson = retChildsJson[j];
                            insertDom(retChildJson, createVquote(retChildJson.rid))
                        }
                    })
                let _vpage = Utils.find(root.el, '.vpage');
                _vpage.innerHTML = pageSize * page < count ? `<button type="button" class="vmore vbtn">${root.locale['ctrl']['more']}</button>` : '';
                let _vmore = Utils.find(_vpage, '.vmore');
                if (_vmore) {
                    Utils.on('click', _vmore, (e) => {
                        _vpage.innerHTML = '';
                        query(++page);
                    })
                }
                root.loading.hide();
            }).catch(ex => {
            root.loading.hide().ErrorHandler(ex,'query')
        })
    }

    fetch(APIURL+'?url='+decodeURI(root.config.path))
        .then(rets => rets.json())
        .then(json => Object.keys(json).length)
        .then(num => {
            if (num > 0) {
                Utils.attr(Utils.find(root.el, '.vinfo'), 'style', 'display:block;');
                Utils.find(root.el, '.vcount').innerHTML = `<span class="vnum">${num}</span> ${root.locale['tips']['comments']}`;
                query();
            } else {
                root.loading.hide();
            }
        }).catch(ex => {
            root.ErrorHandler(ex,'count')
        });

    let insertDom = (rt, node, mt) => {

        let _vcard = Utils.create('div', {
            'class': 'vcard',
            'id': rt.id
        });
        let _img = _avatarSetting['hide'] ? '' : `<img class="vimg" src="${_avatarSetting['cdn']+md5(rt.mail)+_avatarSetting['params']}">`;
        let ua = rt.ua || '';
        let uaMeta = '';
        if (ua) {
            ua = detect(ua);
            let browser = `<span class="vsys">${ua.browser} ${ua.version}</span>`;
            let os = `<span class="vsys">${ua.os} ${ua.osVersion}</span>`;
            uaMeta = `${browser} ${os}`;
        }
        if(root.config.path === '*') uaMeta = `<a href="${rt.url}" class="vsys">${rt.url}</a>`
        let _nick = '';
        let _t = rt.link?(/^https?\:\/\//.test(rt.link) ? rt.link : 'http://'+rt.link) : '';
        _nick = _t ? `<a class="vnick" rel="nofollow" href="${_t}" target="_blank" >${rt.nick}</a>` : `<span class="vnick">${rt.nick}</span>`;
        _vcard.innerHTML = `${_img}
            <div class="vh" rootid=${rt.rid || rt.id}>
                <div class="vhead">${_nick} ${uaMeta}</div>
                <div class="vmeta">
                    <span class="vtime">${timeAgo(new Date(rt.ctime), root.locale)}</span>
                    <span class="vat">${root.locale['ctrl']['reply']}</span>
                </div>
                <div class="vcontent">
                    ${xssFilter(rt.comment)}
                </div>
            </div>`;
        let _vat = Utils.find(_vcard, '.vat');
        let _as = Utils.findAll(_vcard, 'a');
        for (let i = 0, len = _as.length; i < len; i++) {
            let _a = _as[i];
            if (_a && (Utils.attr(_a, 'class') || '').indexOf('at') == -1) {
                Utils.attr(_a, {
                    'target': '_blank',
                    'rel': 'nofollow'
                });
            }
        }
        let _vlis = Utils.findAll(node, '.vcard');
        if (mt) node.appendChild(_vcard);
        else node.insertBefore(_vcard, _vlis[0]);
        let _vcontent = Utils.find(_vcard, '.vcontent');
        // if (_vcontent) expandEvt(_vcontent);  // 不启用点击展开
        if (_vat) bindAtEvt(_vat, rt);
        _activeOtherFn()
    }


    let _activeOtherFn = () => {
        setTimeout(function () {
            try {
                // let MathJax = MathJax || '';
                typeof MathJax !== 'undefined' && MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                if (typeof hljs !== 'undefined') {
                    Utils.each(Utils.findAll('pre code'), function (i, block) {
                        hljs.highlightBlock(block);
                    })
                    Utils.each(Utils.findAll('code.hljs'), function (i, block) {
                        hljs.lineNumbersBlock(block);
                    });
                }
            } catch (ex) {}
        }, 200)
    }

    // expand event
    let expandEvt = (el) => {
        setTimeout(function () {
            if (el.offsetHeight > 180) {
                el.classList.add('expand');
                Utils.on('click', el, e => {
                    Utils.attr(el, 'class', 'vcontent');
                })
            }
        })
    }

    let atData = {}
    // at event
    let bindAtEvt = (el, rt) => {
        Utils.on('click', el, (e) => {
            let at = `@${Utils.escape(rt.nick)}`;
            atData = {
                'at': Utils.escape(at) + ' ',
                'rid': rt.rid || rt.id,
                'pid': rt.id,
                'rmail': rt.mail,
            }
            // console.log(atData)
            Utils.attr(inputs['comment'], 'placeholder', at);
            inputs['comment'].focus();
        })
    }

    // cache
    let getCache = () => {
        let s = _store && _store.ValineCache;
        if (s) {
            s = JSON.parse(s);
            let m = meta;
            for (let i in m) {
                let k = m[i];
                Utils.find(root.el, `.v${k}`).value = Utils.unescape(s[k]);
                defaultComment[k] = s[k];
            }
        }
    }
    getCache();
    // reset form
    let reset = () => {
        defaultComment['comment'] = "";
        inputs['comment'].value = "";
        syncContentEvt(inputs['comment'])
        Utils.attr(inputs['comment'], 'placeholder', root.placeholder);
        atData = {};
        root.preview.empty().hide();
    }

    // submitsubmit
    let submitBtn = Utils.find(root.el, '.vsubmit');
    let submitEvt = (e) => {
        if (Utils.attr(submitBtn, 'disabled')) {
            root.alert.show({
                type: 0,
                text: `${root.locale['tips']['busy']}ヾ(๑╹◡╹)ﾉ"`,
                ctxt: root.locale['ctrl']['ok']
            })
            return;
        }
        if (defaultComment['comment'] == '') {
            inputs['comment'].focus();
            return;
        }
        defaultComment['nick'] = defaultComment['nick'] || '匿名';

        // return;
        // if (root.verify) {
        //     verifyEvt(commitEvt)
        // } else {
        //     commitEvt();
        // }
        commitEvt();
    }

    // get csrftoken
    function getCookie(name) {
        if (!document.cookie) {
          return null;
        }
        const token = document.cookie.split(';')
        .map(c => c.trim())
        .filter(c => c.startsWith(name + '='));
    
        if (token.length === 0) {
          return null;
        }
        return decodeURIComponent(token[0].split('=')[1]);
    }

    let commitEvt = () => {
        Utils.attr(submitBtn, 'disabled', !0);
        root.loading.show(!0);
        let comment = {}
        defaultComment['url'] = decodeURI(root.config.path);
        if (atData['rid']) {
            let pid = atData['pid'] || atData['rid'];
            comment.rid = atData['rid']
            comment.pid = pid
            defaultComment['comment'] = defaultComment['comment'].replace('<p>', `<p><a class="at" href="#${pid}">${atData['at']}</a> , `);
        }
        for (let i in defaultComment) {
            if (defaultComment.hasOwnProperty(i)) {
                comment[i] = defaultComment[i];
            }
        }

        // 检查 URL 格式
        comment['link'] = comment['link']?(/^https?\:\/\//.test(comment['link']) ? comment['link'] : 'http://'+comment['link']) : '';

        const csrftoken = getCookie('csrftoken')
        fetch(APIURL, {
            method: 'post',
            mode: 'same-origin',
            body: JSON.stringify(comment),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRFToken': csrftoken
            }
        })
            .then(res => {
                defaultComment['nick'] != '匿名' && _store && _store.setItem('ValineCache', JSON.stringify({
                    nick: defaultComment['nick'],
                    link: defaultComment['link'],
                    mail: defaultComment['mail']
                }));
                try {
                    Utils.removeAttr(submitBtn, 'disabled');
                    root.loading.hide();
                    reset();
                    if (res.ok) {
                        root.alert.show({
                            type: 0,
                            text: `评论已提交，站长审核后可见😃`,
                            ctxt: root.locale['ctrl']['ok']
                        })
                    } else if (res.status == 400) {
                        // 一般为邮箱或者链接格式错误
                        root.alert.show({
                            type: 0,
                            text: `😑出错了！</br>请检查您输入的网址邮箱等格式是否有误~`,
                            ctxt: root.locale['ctrl']['ok']
                        })
                    } else {
                        // 其他错误
                        root.alert.show({
                            type: 0,
                            text: `😑出错了！</br>错误类型：` + res.status.toString() + ` ` + res.statusText + `</br>请联系告知我这个错误，十分感谢😃`,
                            ctxt: root.locale['ctrl']['ok']
                        })
                    }
                    
                } catch (ex) {
                    root.ErrorHandler(ex,'save');
                }
            }).catch(ex => {
            root.ErrorHandler(ex,'commitEvt');
        })
    }

    let verifyEvt = (fn) => {
        let x = Math.floor((Math.random() * 10) + 1);
        let y = Math.floor((Math.random() * 10) + 1);
        let z = Math.floor((Math.random() * 10) + 1);
        let opt = ['+', '-', 'x'];
        let o1 = opt[Math.floor(Math.random() * 3)];
        let o2 = opt[Math.floor(Math.random() * 3)];
        let expre = `${x}${o1}${y}${o2}${z}`;
        let subject = `${expre} = <input class='vcode vinput' >`;
        root.alert.show({
            type: 1,
            text: subject,
            ctxt: root.locale['ctrl']['cancel'],
            otxt: root.locale['ctrl']['ok'],
            cb() {
                let code = +Utils.find(root.el, '.vcode').value;
                let ret = (new Function(`return ${expre.replace(/x/g, '*')}`))();
                if (ret === code) {
                    fn && fn();
                } else {
                    root.alert.show({
                        type: 1,
                        text: `(T＿T)${root.locale['tips']['again']}`,
                        ctxt: root.locale['ctrl']['cancel'],
                        otxt: root.locale['ctrl']['try'],
                        cb() {
                            verifyEvt(fn);
                            return;
                        }
                    })
                }
            }
        })
    }


    Utils.on('click', submitBtn, submitEvt);
    Utils.on('keydown', document, function (e) {
        e = event || e;
        let keyCode = e.keyCode || e.which || e.charCode;
        let ctrlKey = e.ctrlKey || e.metaKey;
        // Shortcut key
        ctrlKey && keyCode === 13 && submitEvt()
        // tab key
        if (keyCode === 9) {
            let focus = document.activeElement.id || ''
            if (focus == 'veditor') {
                e.preventDefault();
                _insertAtCaret(_veditor, '    ');
            }
        }
    });
    Utils.on('paste',document,(e)=>{
        let clipboardData = "clipboardData" in e ? e.clipboardData : (e.originalEvent && e.originalEvent.clipboardData || window.clipboardData)
        let items = clipboardData && clipboardData.items;
        let files = [];
        if (items && items.length>0) {
            // 检索剪切板items
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    files.push(items[i].getAsFile());
                    break;
                }
            }
            if(files.length) {
                for(let idx in files){
                    let file = files[idx],
                        uploadText = `![Uploading ${file['name']}]()`;
                    _insertAtCaret(_veditor, uploadText);
                    file && uploadImage(file,function(err,ret){
                        if(!err && ret) _veditor.value = _veditor.value.replace(uploadText,`\r\n![${file['name']}](${ret['data']})`)
                    })
                }
            }
        }

    })


    let uploadImage = (file,callback)=>{
        let formData = new FormData();
        formData.append('file', file);
        let xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                try {
                    let json = JSON.parse(xhr.responseText);
                    callback && callback(null,json)
                } catch (err) {
                    callback && callback(err)
                }
            } else {
                callback && callback(xhr.status)
            }
        }
        xhr.onerror = function(e){
            console.log(e)
        }
        // xhr.open('POST', 'https://sm.ms/api/v2/upload?inajax=1',true);
        // xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
        xhr.open('POST','https://imgkr.com/api/files/upload',true);
        xhr.send(formData);
    }

}

function Valine(options) {
    return new ValineFactory(options)
}

module.exports = Valine;
module.exports.default = Valine;

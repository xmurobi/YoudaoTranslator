
import { Adapter, Result } from "./adapter";
import md5 from "../libs/md5";
import redaxios from '../libs/redaxios';
import { parse } from '../libs/parse5';


class Youdao implements Adapter {
  key: string;

  secret: string;

  word: string = "";

  isChinese: boolean = false;

  results: Result[] = [];

  phonetic: string = "";

  constructor(key: string, secret: string) {
    this.key = key;
    this.secret = secret;
  }

  url(word: string): string {
    this.isChinese = this.detectChinese(word);
    this.word = word;

    const from = this.isChinese ? "zh-CHS" : "auto";
    const to = this.isChinese ? "en" : "zh-CHS";
    const salt = Math.floor(Math.random() * 10000).toString();
    const sign = md5(`${this.key}${word}${salt}${this.secret}`);

    const params = new URLSearchParams({
      q: word,
      from,
      to,
      appKey: this.key,
      salt,
      sign,
    });

    return "https://openapi.youdao.com/api?" + params.toString();
  }

  async parse(data: any): Promise<Result[]> {
    if (data.errorCode !== "0") {
      return this.parseError(data.errorCode);
    }

    const { translation, webdict, web } = data;

    this.parseTranslation(translation);
    // this.parseBasic(basic);
    // this.parseWeb(web);
    await this.parseWebdict(webdict);

    return this.results;
  }

  private parseTranslation(translation: object) {
    if (translation) {
      const pronounce = this.isChinese ? translation[0] : this.word;
      this.addResult( translation[0], this.word, translation[0], pronounce );
    }
  }

  private parseBasic(basic: any) {
    if (basic) {
      let pronounce;
      basic.explains.forEach((explain) => {
        pronounce = this.isChinese ? explain : this.word;
        this.addResult(explain, this.word, explain, pronounce);
      });

      if (basic.phonetic) {
        // 获取音标，同时确定要发音的单词
        const phonetic: string = this.parsePhonetic(basic);
        this.addResult( phonetic, "回车可听发音", "~" + pronounce, pronounce );
      }
    }
  }

  private parseWeb(web: any) {
    if (web) {
      web.forEach((item, index) => {
        let pronounce = this.isChinese ? item.value[0] : item.key;
        this.addResult( item.value.join(", "), item.key, item.value[0], pronounce);
      });
    }
  }

  private async parseWebdict(t: any) {
    const url = t?.["url"];
    try {
      // console.log("Webdict URL:", url);
      const response = await redaxios.create().get(url);
      if (!response.ok) {
        throw new Error('Network response was not ok.');
      }
      const html = response.data; // response.body 是原始 HTML

      // 使用 parse5 解析 HTML
      const document = parse(html);

      // 查找所有符合条件的 div.content-wrp.dict-container.opened
      const dictContainers = this.findElementsByClass(document, 'div', ['content-wrp', 'dict-container', 'opened']);
      // console.log("How many containers:",dictContainers.length);

      dictContainers.forEach((el) => {
        this.parseResultItems(el);
      });

    } catch (error) {
      console.error('There has been a problem with your fetch operation:', error);
    }
  }

  private parseResultItems(item: any) {
    const e = this.word;

    // 查找 div.trans-container
    const transContainers = this.findElementsByClass(item, 'div', ['trans-container']);
    transContainers.forEach((tc) => {

      let phonetics: string[] = [];

      // 查找所有 span.phonetic
      const phoneticSpans = this.findElementsByClass(tc, 'span', ['phonetic']);
      phoneticSpans.forEach((span) => {
        const parent = span.parentNode;
        let label = '';
        if (parent && parent.childNodes.length > 0) {
          const firstChild = parent.childNodes[0];
          if (firstChild.nodeName === '#text') {
            label = firstChild.value.trim();
          }
        }
        const phoneticText = span.childNodes.map((child: any) => child.value).join('').trim();
        phonetics.push(`${label} ${phoneticText}`);
      });

      const phoneticsCombined = phonetics.join('; ');
      if (phoneticsCombined) {
        this.addResult(phoneticsCombined, "回车可听发音", e, e, true, false);
      }

      // 查找所有 span style="cursor: pointer;"
      // let trans = [];
      // const transItems = this.findElementsByClass(tc, 'div', ['trans-container', 'web_trans']);
      // transItems.forEach((item) => {

      //     // 获取所有 span 子元素
      //     const spanElements = this.findElementsByTag(item, 'span');
      //     let title = '';
      //     if (spanElements.length > 0) {
      //         title = this.getTextContent(spanElements[0]).trim();  // 获取 span 的文本内容

      //         const parent = spanElements[0].parentNode;

      //         let subtitle = "";
      //         if (parent && parent.childNodes.length > 2) {
      //             const firstChild = parent.childNodes[1];
      //             if (firstChild.nodeName === '#text') {
      //                 subtitle = firstChild.value.trim();  // 获取子节点的文本
      //             }
      //         }
      //         // console.log("subtitle:", subtitle)

      //         // 调用 addResult，确保 title 不为空
      //         if (title) {
      //             this.addResult(title, subtitle);
      //         }

      //     }

      // });
    });

    // 查找所有 ul li 和 ul a.clickable
    const translationLists = this.findElementsByTag(item, 'ul');
    translationLists.forEach((ul) => {
      const lis = this.findElementsByTag(ul, 'li');
      lis.forEach((li) => {
        const text = this.getTextContent(li).trim();
        if (text) {
          // console.log("Got text:", this.fixEncodingBrowser(text));
          this.addResult(text, this.word, e, e);
        }
      });

      const clickableLinks = this.findElementsByClass(ul, 'a', ['clickable']);
      clickableLinks.forEach((a) => {
        const text = this.getTextContent(a).trim();
        if (text) {
          this.addResult(text, this.word, e, e);
        }
      });
    });
  }


  /**
   * 查找具有特定类名的元素
   * @param node 当前节点
   * @param tag 标签名
   * @param classes 类名数组
   * @returns 匹配的元素数组
   */
  private findElementsByClass(node: any, tag: string, classes: string[]): any[] {
    let results: any[] = [];

    if (node.tagName === tag) {
      const classAttr = node.attrs.find((attr: any) => attr.name === 'class');
      if (classAttr) {
        const nodeClasses = classAttr.value.split(/\s+/);
        const hasAllClasses = classes.every(cls => nodeClasses.includes(cls));
        if (hasAllClasses) {
          results.push(node);
        }
      }
    }

    if (node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach((child: any) => {
        results = results.concat(this.findElementsByClass(child, tag, classes));
      });
    }

    return results;
  }

  /**
   * 查找具有特定标签名的元素
   * @param node 当前节点
   * @param tag 标签名
   * @returns 匹配的元素数组
   */
  private findElementsByTag(node: any, tag: string): any[] {
    let results: any[] = [];

    if (node.tagName === tag) {
      results.push(node);
    }

    if (node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach((child: any) => {
        results = results.concat(this.findElementsByTag(child, tag));
      });
    }

    return results;
  }

  /**
   * 获取元素的文本内容
   * @param node 当前节点
   * @returns 文本内容
   */
  private getTextContent(node: any): string {
    let text = '';

    if (node.nodeName === '#text') {
      text += node.value;
    }

    if (node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach((child: any) => {
        text += this.getTextContent(child);
      });
    }

    return text;
  }
  private parsePhonetic(basic: any): string {
    let phonetic: string = '';

    if (this.isChinese && basic.phonetic) {
      phonetic = "[" + basic.phonetic + "] ";
    }

    if (basic["us-phonetic"]) {
      phonetic += " [美: " + basic["us-phonetic"] + "] ";
    }

    if (basic["uk-phonetic"]) {
      phonetic += " [英: " + basic["uk-phonetic"] + "]";
    }

    return phonetic;
  }

  private parseError(code: number): Result[] {
    const messages = {
      101: "缺少必填的参数",
      102: "不支持的语言类型",
      103: "翻译文本过长",
      108: "应用ID无效",
      110: "无相关服务的有效实例",
      111: "开发者账号无效",
      112: "请求服务无效",
      113: "查询为空",
      202: "签名检验失败,检查 KEY 和 SECRET",
      401: "账户已经欠费",
      411: "访问频率受限",
    };

    const message = messages[code] || "请参考错误码：" + code;

    return this.addResult("👻 翻译出错啦", message, "Ooops...", "", false, false);
  }

  private addResult( title: string, subtitle: string, arg: string = "", pronounce: string = "", fixtitle: boolean = true, fixsubtitle: boolean = true): Result[] {
    const quicklookurl = "https://www.youdao.com/w/" + this.word;
    // 修复乱码
    if (fixtitle) {
      title = this.fixEncodingBrowser(title);
    }

    const maxLength = this.detectChinese(title) ? 24 : 60;
    
    if (title.length > maxLength) {
      const copy = title;
      // 使用 Array.from() 来处理 Unicode 字符，防止多字节字符乱码
      const titleArray = Array.from(copy);

      title = titleArray.slice(0, maxLength).join('');
      subtitle = titleArray.slice(maxLength).join('');
    } 


    this.results.push({ title, subtitle, arg, pronounce, quicklookurl });
    return this.results;
  }

  /**
   * 修复字符串编码（浏览器环境）
   * @param {string} str - 乱码字符串，例如 "æ"
   * @returns {string} - 正确解码后的字符串，例如 "操"
   */
  private fixEncodingBrowser(str: string): string {
      // 将字符串转换为字节数组（假设原始编码为 Windows-1252）
      const bytes = new Uint8Array([...str].map(char => char.charCodeAt(0)));
      // 创建一个 TextDecoder 实例，指定使用 Windows-1252 解码
      const decoder = new TextDecoder('utf-8');
      // 解码为 UTF-8 字符串
      const decoded = decoder.decode(bytes);
      return decoded;
  }

  private detectChinese(word: string): boolean {
    // 使用正则表达式检测是否包含中文字符 (包括全角字符)
    return /[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf]/.test(word);
  }

}

export default Youdao;

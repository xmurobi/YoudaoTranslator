
declare var tjs;

import Translator from './translator';


const main = async () => {
  try {
    // console.log('platform:', tjs.env['platform'], "key", tjs.env['key'], "sec", tjs.env['secret'] )

    const translator = new Translator(
      tjs.env['key'] || '', 
      tjs.env['secret'] || '', 
      tjs.env['platform'] || 'Youdao'
    );


    const word: string = Array.from(tjs.args).pop() as string;

    var result = await translator.translate(word);

    console.log(result);

  } catch (error) {
    console.error('Error during translation:', error);
  }
};

main();
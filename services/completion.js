const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanMessage, SystemMessage, AIMessage } = require('langchain/schema');

const baseURL = process.env.OPENAI_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const completion = async (messages, temperature = 0) => {
  const chat = new ChatOpenAI({
    modelName: 'gpt-4', //gpt-4
    openAIApiKey: OPENAI_API_KEY,
    configuration: {
      baseURL: baseURL,
    },
    temperature: temperature,
  });
  return await chat.call(messages);
};

const recommendEat = async (eatList, historyMessages) => {
  const messages = [
    new SystemMessage(
      `你是一个美食助手，请根据我提供的餐馆列表上下文，根据我提供的喜好, 来帮助我挑选一家餐馆。
      餐馆列表上下文会被引用在 ''' 之中
      餐馆列表上下文：'''${JSON.stringify(eatList)}'''
      请只推荐符合要求的一家，并用以下 JSON 格式进行输出：
      {
        reason: 推荐的理由
        name: 餐馆的名字
        id: 餐馆的 id,
      }
      `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 0);
  return res;
};

const getPromptQuestion = async (eatList, historyMessages) => {
  console.log('enter get prompt question');
  const messages = [
    new SystemMessage(
      `你是一个美食助手，你将通过向用户连续提问的方式来识别用户的需求
      请结合餐馆列表上下文和历史提问来提出下一个问题，这个问题将帮助我从餐馆列表中选择出一家我最想去的餐馆。
      问题需要和口味相关，比如“您喜欢吃辣吗”或者“你喜欢鸡肉吗”或者“你喜欢火锅吗”
      不要提供和口味无关的问题，比如“您是否需要早餐店提供电话预定服务？”和“您是否对早餐店的环境有特别的要求，比如需要安静的环境，或者喜欢热闹的氛围？”等等
      餐馆列表上下文会被引用在 ''' 之中。
      餐馆列表上下文：'''${JSON.stringify(eatList)}'''
      请每次都问更详细的问题,不要重复类似的问题
      如果没有新问题了，请返回“我没有新问题了”
    `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 1);
  console.log('生成的问题：', res.text);
  return res;
};

// 云函数入口函数
const getRecommendRestaurant = async (eatList = [], history = []) => {
  const restaurantInfo = eatList.map(({ title, id, category }) => {
    return { id, title, category };
  });
  const historyMessages = history.map((msg) => {
    return msg.role === 'AI'
      ? new AIMessage(msg.content)
      : new HumanMessage(msg.content);
  });

  const res =
    history.length % 6 === 0 && history.length > 0
      ? await recommendEat(restaurantInfo, historyMessages)
      : await getPromptQuestion(restaurantInfo, historyMessages);
  return res.text;
};

module.exports = {
  getRecommendRestaurant,
};

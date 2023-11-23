const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanMessage, SystemMessage, AIMessage } = require('langchain/schema');

const baseURL = process.env.OPENAI_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const completion = async (
  messages,
  temperature = 0,
  model = 'gpt-4' //gpt-4, gpt-3.5-turbo
) => {
  const chat = new ChatOpenAI({
    modelName: model,
    openAIApiKey: OPENAI_API_KEY,
    configuration: {
      baseURL: baseURL,
    },
    temperature: temperature,
  });
  return await chat.call(messages);
};

const recommendEat = async (eatList, historyMessages) => {
  const restaurantInfo = eatList.map(({ title, category }) => {
    return { title, category };
  });
  const messages = [
    new SystemMessage(
      `你是一个美食助手，请根据我提供的餐馆列表上下文，以及对话上下文，来帮助我挑选一家餐馆。
      餐馆列表上下文会被引用在 ''' 之中。餐馆列表上下文：'''${JSON.stringify(
          restaurantInfo
      )}'''
      请只推荐最符合要求的一家，并用以下 JSON 格式进行输出：
      {
        reason: 推荐的理由
        name: 餐馆的名字
      }
      注意，只输出 JSON 格式，不要包含其他信息。
      `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 0);
  return res.content;
};

const getSearchKeyword = async (historyMessages) => {
  console.log("enter get search keyword")
  const messages = [
    new SystemMessage(
      `你是一个腾讯地图搜索专家。会根据对话记录上下文，生成用于在腾讯地图上搜索餐馆信息的关键词。
      注意关键词的格式，包括空格和分隔符。
      只输出关键词，不要有其他
      `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 0.3);
  console.log("return res:", res);
  return {"keyword": res.content};
};

const getPromptQuestion = async (historyMessages) => {
  const messages = [
    new SystemMessage(
      `你是一个的美食助手，你将通过向中国的用户连续提问的方式来引导用户寻找餐馆, 这个问题将帮助用户选择出想吃的餐馆类型
      请每次都根据之前的问题不断深入,不要重复类似的问题，问题需要和口味相关，不要提供和口味无关的问题。
      请不要带上具体的地区和餐饮派系
      使用非常简洁一句话风格，尽量在三个问题以内得到用户的喜好
      请返回最合适的一个问题，并用以下 JSON 格式进行输出：
      {
        question: 提问的问题
      }
      请注意json的格式一定要正确
      `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 1);
  return res.content;
};

// 云函数入口函数
const getRecommendRestaurant = async (history = []) => {
  const historyMessages = history.map((msg) => {
    return msg.role === 'AI'
      ? new AIMessage(msg.content)
      : new HumanMessage(msg.content);
  });

  const res =
    history.length % 6 === 0 && history.length > 0
      ? await getSearchKeyword(historyMessages)
      : await getPromptQuestion(historyMessages);
  return res;
};

module.exports = {
  getRecommendRestaurant, recommendEat
};

const { ChatOpenAI } = require('langchain/chat_models/openai');
const { ChatPromptTemplate } = require('langchain/prompts');
const { HumanMessage, SystemMessage, AIMessage } = require('langchain/schema');
const { StructuredOutputParser } = require('langchain/output_parsers');
const { LLMChain } = require('langchain/chains');

const baseURL = process.env.OPENAI_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const chatModel = (
  temperature = 0,
  model = 'gpt-3.5-turbo' //gpt-4, gpt-3.5-turbo
) => {
  return new ChatOpenAI({
    modelName: model,
    openAIApiKey: OPENAI_API_KEY,
    configuration: {
      baseURL: baseURL,
    },
    temperature: temperature,
  });
};

const completion = async (
  messages,
  temperature = 0,
  model = 'gpt-4' //gpt-4, gpt-3.5-turbo
) => {
  const chat = chatModel(temperature, model);
  return await chat.call(messages);
};

const recommendEat = async (eatList, historyMessages) => {
  const restaurantInfo = eatList.map(({ title, category }) => {
    return { title, category };
  });

  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    reason: '推荐这家餐馆的理由，如果没找到的话， 填入 null',
    title: '在餐馆列表中这家餐馆的名字，如果没找到的话，填入 null',
  });

  const messages = [
    new SystemMessage(
      `你是一个美食助手，请根据我提供的餐馆列表上下文，以及对话上下文，来帮助我挑选一家餐馆。
      餐馆列表上下文会被引用在 ''' 之中。餐馆列表上下文：'''{restaurantList}'''
      请只推荐最符合要求的一家。
      `
    ),
    ...historyMessages,
  ];

  const chatPrompt = ChatPromptTemplate.fromMessages(messages);

  const chain = new LLMChain({
    prompt: chatPrompt,
    llm: chatModel(0, 'gpt-4'),
    outputParser: parser,
    verbose: true,
  });

  const res = await chain.invoke({
    restaurantList: JSON.stringify(restaurantInfo),
  });
  return res;
};

const getSearchKeyword = async (
  historyMessages,
  period = '午餐',
  location = '中国'
) => {
  console.log('enter get search keyword', period, location);
  const messages = [
    new SystemMessage(
      `你是一个腾讯地图搜索专家。会根据对话记录上下文，生成用于在腾讯地图上搜索餐馆信息的关键词。目前是${period}的用餐时间,用餐位置在${location}。
      关键词要求:
      ---
      1. 注意关键词的格式，包括空格和分隔符。
      2. 只输出关键词，不要有其他。
      3. 注意这是地图搜索的关键词，需要是明确的地点类型。
      4. 关键词要符合用户的偏好喝目前的用餐时间
      ---
      例子：
      ---
        用户偏好：麻辣，赶时间
        用餐时间：午餐
        关键词：川菜馆 麻辣烫 快餐...（可以更多）
      ---

      关键词：
      `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 0);
  console.log('return res:', res);
  return { keyword: res.content };
};

const getPromptQuestion = async (
  historyMessages,
  period = '午餐',
  location = '中国'
) => {
  console.log('clarify question for user ', period, location);
  const messages = [
    new SystemMessage(
      `你是一个的美食助手，你将通过连续提问的方式来引导用户寻找餐馆，这个问题将帮助用户选择出想吃的餐馆类型。目前是${period}的用餐时间，用餐位置在${location}。
      问题要求: 
      ---
      1. 每次都根据之前的问答不断深入，不要重复类似的问题。
      2. 只提出用餐相关的问题，包括口味偏好，用餐类型（e.g. 工作餐，随便吃吃，正餐等等）。
      3. 问题需要符合我的用餐时间和地点。
      4. 问题需要有渐进引导性，不要过于概括。
      ---
      
      问题例子：
      ---
      1. 你喜欢吃比较辣的餐馆，例如麻辣烫吗？
      2. 你顿饭需要赶时间还是可以慢慢吃？
      3. 米饭或是面条，米线这些你倾向于什么呢？
      ---

      注意：每轮对话只提一个问题，使用非常简洁一句话风格。

      提问：
      `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 1);
  return { question: res.content };
};

// 云函数入口函数
const getRecommendRestaurant = async (history = [], period, location) => {
  const historyMessages = history.map((msg) => {
    return msg.role === 'AI'
      ? new AIMessage(msg.content)
      : new HumanMessage(msg.content);
  });

  const res =
    history.length % 6 === 0 && history.length > 0
      ? await getSearchKeyword(historyMessages, period, location)
      : await getPromptQuestion(historyMessages, period, location);
  return res;
};

module.exports = {
  getRecommendRestaurant,
  recommendEat,
};

const { ChatOpenAI } = require('langchain/chat_models/openai');
const {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  PromptTemplate,
} = require('langchain/prompts');
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

const recommendEat = async (eatList, history, period, location) => {
  const restaurantInfo = eatList.map(({ title, category, id }) => {
    return { title, category, id };
  });

  const historyMessages = history.map((msg) => {
    return msg.role === 'AI'
      ? new AIMessage(msg.content)
      : new HumanMessage(msg.content);
  });

  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    reason: '推荐这家餐馆的理由，如果没找到的话，填入 null',
    title: '在餐馆列表中这家餐馆的名字，如果没找到的话，填入 null',
    id: '在餐馆列表中这家餐馆的 id，如果没找到的话，填入 null',
  });

  const systemPromptTemplate = new PromptTemplate({
    template: `你是一个美食助手，请根据我提供的候选餐馆列表，以及之前的对话历史记录，来帮助我挑选一家餐馆。目前是${period}的用餐时间,用餐位置在${location}。
    候选餐馆列表会被引用在 ''' 之中。
    候选餐馆列表：'''{restaurantInfo}'''
    只推荐最符合要求的一家。挑选的餐馆请符合用餐时间和位置。

    {format_instructions}
    `,
    inputVariables: ['restaurantInfo', 'format_instructions'],
  });

  const systemPrompt = new SystemMessagePromptTemplate({
    prompt: systemPromptTemplate,
  });

  const chatPrompt = ChatPromptTemplate.fromMessages([
    ...historyMessages,
    systemPrompt,
  ]);
  console.log(123, chatPrompt);

  const chain = new LLMChain({
    prompt: chatPrompt,
    llm: chatModel(0, 'gpt-4'),
    outputParser: parser,
    verbose: true,
  });

  const res = await chain.invoke({
    restaurantInfo: JSON.stringify(restaurantInfo),
    format_instructions: parser.getFormatInstructions(),
  });
  console.log('return recommend eat', res?.text);
  return { recommendEat: res.text };
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
        关键词：快餐 麻辣烫 冒菜...（可以更多）

        用户偏好：麻辣
        用餐时间：晚餐
        关键词：川菜馆 火锅 烧烤...（可以更多）
      ---

      你必须按照以下'''中的格式输出：
      '''关键词1 关键词2 ...'''

      关键词: 
      `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 0);
  console.log('return keyword res:', res.content);
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
      你喜欢吃比较辣的餐馆，例如麻辣烫吗？
      你顿饭需要赶时间还是可以慢慢吃？
      米饭或是面条，米线这些你倾向于什么呢？
      ---

      注意：每轮对话只提一个问题，使用非常简洁一句话风格。

      提问：
      `
    ),
    ...historyMessages,
  ];
  const res = await completion(messages, 1);
  console.log('return question', res.content);
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

import { BrainDumpItem, BudgetConfig, Skill, Wallet, ChatMessage } from '../types';
import { createGeminiClient, DEFAULT_FLASH_MODEL } from './aiService';
import { formatBudgetRuleContext } from './budgetCategoryService';

export const generateChatResponse = async (
    message: string,
    history: ChatMessage[],
    items: BrainDumpItem[],
    budgetConfig: BudgetConfig,
    wallets: Wallet[],
    skills: Skill[],
    monthlyThemes: Record<string, string>,
    chatModel?: string
): Promise<string> => {
    const ai = createGeminiClient();
    if (!ai) {
        return "Please configure your Gemini API key in the settings to use the chat feature.";
    }
    const activeModel = chatModel || DEFAULT_FLASH_MODEL;

    // Truncate items to the last 200 to prevent massive payloads
    const recentItems = items.slice(-200);

    const systemInstruction = `
You are an intelligent assistant for a personal productivity and finance app called BrainDump AI.
You have access to the user's data, including their notes, todos, finances, skills, wallets, and monthly themes.
Answer the user's questions based on this data. Be concise, helpful, and friendly.
If the user asks for advice or suggestions, provide them based on their data. Pay special attention to their monthly themes, as they represent the user's overarching goals and focus for each month. Use these themes to guide your advice and insights.
If the user asks about something not in the data, answer generally but remind them you are looking at their app data.
When discussing or classifying spending, always use the user's configured budget categories as the source of truth. Do not invent categories outside their configured budget list.

Here is the user's current data context (in JSON format):
---
MONTHLY THEMES:
${JSON.stringify(monthlyThemes, null, 2)}

ITEMS (Last 200):
${JSON.stringify(recentItems.map(i => ({ type: i.type, content: i.content, status: i.status, meta: i.meta, created_at: i.created_at, completed_at: i.completed_at })), null, 2)}

BUDGET CONFIG:
${JSON.stringify(budgetConfig, null, 2)}

BUDGET CATEGORY RULES:
${formatBudgetRuleContext(budgetConfig)}

WALLETS:
${JSON.stringify(wallets, null, 2)}

SKILLS:
${JSON.stringify(skills, null, 2)}
---
`;

    try {
        // We can format the history manually and send it as a single prompt if we don't want to use the chat session,
        // or we can use the chat session and send messages sequentially.
        // Since we want to maintain context, sending the whole history as a single prompt is easier and stateless.
        
        let prompt = "";
        for (const msg of history) {
            prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}\n\n`;
        }
        prompt += `User: ${message}\n\nAssistant:`;

        const response = await ai.models.generateContent({
            model: activeModel,
            contents: prompt,
            config: {
                systemInstruction,
                temperature: 0.7,
            }
        });

        return response.text || "Sorry, I couldn't generate a response.";
    } catch (error) {
        console.error("Chat error:", error);
        return "Sorry, I encountered an error while processing your request.";
    }
};

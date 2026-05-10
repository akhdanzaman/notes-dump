import { BrainDumpItem, BudgetConfig, Skill, Wallet, ChatMessage } from '../types';
import { createGeminiClient, getGeminiKey, withAiRetry, DEFAULT_FLASH_MODEL } from './aiService';

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
    const apiKey = getGeminiKey();
    const ai = createGeminiClient(apiKey);

    if (!ai || !apiKey) {
        return "Please configure your Gemini API key in the settings to use the chat feature.";
    }

    const activeModel = chatModel || DEFAULT_FLASH_MODEL;
    const recentItems = items.slice(-200);
    const recentHistory = history.slice(-20);

    const systemInstruction = `
You are an intelligent assistant for a personal productivity and finance app called Arkaiv, tagline "Ngarsip Harian".
You have access to the user's data, including their notes, todos, finances, skills, wallets, and monthly themes.
Answer the user's questions based on this data. Be concise, helpful, and friendly.
If the user asks for advice or suggestions, provide them based on their data. Pay special attention to their monthly themes, as they represent the user's overarching goals and focus for each month. Use these themes to guide your advice and insights.
If the user asks about something not in the data, answer generally but remind them you are looking at their app data.

Here is the user's current data context (in JSON format):
---
MONTHLY THEMES:
${JSON.stringify(monthlyThemes, null, 2)}

ITEMS (Last 200):
${JSON.stringify(recentItems.map(i => ({ type: i.type, content: i.content, status: i.status, meta: i.meta, created_at: i.created_at, completed_at: i.completed_at })), null, 2)}

BUDGET CONFIG:
${JSON.stringify(budgetConfig, null, 2)}

WALLETS:
${JSON.stringify(wallets, null, 2)}

SKILLS:
${JSON.stringify(skills, null, 2)}
---
`;

    try {
        let prompt = "";
        for (const msg of recentHistory) {
            prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}\n\n`;
        }
        prompt += `User: ${message}\n\nAssistant:`;

        const response = await withAiRetry(() => ai.models.generateContent({
            model: activeModel,
            contents: prompt,
            config: {
                systemInstruction,
                temperature: 0.7,
            }
        }));

        return response.text?.trim() || "Sorry, I couldn't generate a response.";
    } catch (error) {
        console.error("Chat error:", error);
        return "Sorry, I encountered an error while processing your request.";
    }
};

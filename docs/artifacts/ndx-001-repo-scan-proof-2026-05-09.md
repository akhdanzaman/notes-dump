# NDX-001 repo scan proof

Generated: 2026-05-09T09:59:31+08:00
Repo: /home/ubuntu/.openclaw/workspace/notes-dump
Branch: beta
HEAD: 5e36c77

## Parser/review/save grep proof
Command:
```bash
grep -RInE "routeParserInput|classifyLocalIntent|parseLocalFinanceCommand|classifyText|parsePro|canonicalizeParserResults|guardParserResultMultiplicity|pendingReviews|enableDraftReview|executeParserResults|saveAndSync|ReviewCenterPanel|PendingReviewList|generateContent|ParserResultV2|ParserRouterDecisionMetadata" hooks services utils components App.tsx types.ts
```

Output excerpt:
```text
hooks/useBrainDumpData.ts:16:    ParserResultV2,
hooks/useBrainDumpData.ts:39:import { classifyText, DEFAULT_PROMPT } from '../services/geminiService';
hooks/useBrainDumpData.ts:40:import { parsePro } from '../services/geminiProService';
hooks/useBrainDumpData.ts:43:import { canonicalizeParserResults, learnCanonicalRulesFromReview, sweepHistoricalCanonicalMeta, HistoricalCanonicalReview } from '../services/canonicalizerService';
hooks/useBrainDumpData.ts:47:import { guardParserResultMultiplicity } from '../utils/parserResultGuards';
hooks/useBrainDumpData.ts:48:import { routeParserInput } from '../services/parserRouter';
hooks/useBrainDumpData.ts:279:const convertLegacyResultsToNative = (legacyResults: Partial<BrainDumpItem>[], originalText: string): ParserResultV2[] => {
hooks/useBrainDumpData.ts:387:    const [appSettings, setAppSettings] = useState<AppSettings>({ defaultCollapsed: true, hideMoney: false, enableDraftReview: false });
hooks/useBrainDumpData.ts:404:    const [pendingReviews, setPendingReviews] = useState<HistoricalCanonicalReview[]>([]);
hooks/useBrainDumpData.ts:572:    const saveAndSync = useCallback(async (
hooks/useBrainDumpData.ts:632:            saveAndSync(sweep.items, undefined, undefined, undefined, undefined, undefined, undefined, canonicalRulesRef.current);
hooks/useBrainDumpData.ts:636:    }, [replaceHistoricalCanonicalReviews, saveAndSync]);
hooks/useBrainDumpData.ts:654:        saveAndSync(undefined, undefined, undefined, undefined, undefined, undefined, undefined, nextRules);
hooks/useBrainDumpData.ts:655:    }, [saveAndSync]);
hooks/useBrainDumpData.ts:716:                        saveAndSync(canonicalSweep.items, data.budgetConfig, data.customPrompt, data.skills, walletsForSweep, data.monthlyThemes, data.appSettings, data.canonicalRules);
hooks/useBrainDumpData.ts:729:                    saveAndSync(data.data || [], data.budgetConfig, data.customPrompt, defaults, data.wallets, data.monthlyThemes, data.appSettings, data.canonicalRules);
hooks/useBrainDumpData.ts:764:    }, [replaceHistoricalCanonicalReviews, saveAndSync]);
hooks/useBrainDumpData.ts:879:        result: ParserResultV2,
hooks/useBrainDumpData.ts:928:        result: ParserResultV2,
hooks/useBrainDumpData.ts:948:    const buildTransferItem = (result: ParserResultV2, payload: TransferMoneyPayload): BrainDumpItem => {
hooks/useBrainDumpData.ts:967:    const buildSavingFundsItem = (result: ParserResultV2, payload: AddSavingFundsPayload): BrainDumpItem => {
hooks/useBrainDumpData.ts:988:    const executeParserResults = (
hooks/useBrainDumpData.ts:989:        parsedResults: ParserResultV2[],
hooks/useBrainDumpData.ts:1323:            saveAndSync(
hooks/useBrainDumpData.ts:1352:            const routed = await routeParserInput(
hooks/useBrainDumpData.ts:1364:                        return parsePro(
hooks/useBrainDumpData.ts:1381:                    const legacy = await classifyText(
hooks/useBrainDumpData.ts:1407:            let parsedResults: ParserResultV2[] = routed.results;
hooks/useBrainDumpData.ts:1409:            parsedResults = canonicalizeParserResults(parsedResults, {
hooks/useBrainDumpData.ts:1416:            const guardedResults = guardParserResultMultiplicity(parsedResults, text);
hooks/useBrainDumpData.ts:1419:            const enableDraftReview = appSettingsRef.current.enableDraftReview ?? false;
hooks/useBrainDumpData.ts:1422:            if (routed.decision.route === 'review' || (enableDraftReview && routed.decision.route === 'deep_ai')) {
hooks/useBrainDumpData.ts:1425:                executeParserResults(parsedResults, text, tempId);
hooks/useBrainDumpData.ts:1462:    const getResultTargetItemId = (result: ParserResultV2): string | undefined => {
hooks/useBrainDumpData.ts:1503:            saveAndSync(
hooks/useBrainDumpData.ts:1538:            saveAndSync(updated);
hooks/useBrainDumpData.ts:1544:    const handleApproveReview = (id: string, updatedResults: ParserResultV2[]) => {
hooks/useBrainDumpData.ts:1545:        const review = pendingReviews.find(r => r.id === id);
hooks/useBrainDumpData.ts:1555:        const guardedResults = guardParserResultMultiplicity(updatedResults, review.text).results;
hooks/useBrainDumpData.ts:1556:        executeParserResults(guardedResults, review.text, id, nextCanonicalRules);
hooks/useBrainDumpData.ts:1564:            saveAndSync(updated);
hooks/useBrainDumpData.ts:1721:        saveAndSync(updatedItems);
hooks/useBrainDumpData.ts:1748:        saveAndSync(updatedList);
hooks/useBrainDumpData.ts:1757:        saveAndSync(updatedItems);
hooks/useBrainDumpData.ts:1765:        saveAndSync(normalized);
hooks/useBrainDumpData.ts:1901:        saveAndSync(updated);
hooks/useBrainDumpData.ts:2033:        saveAndSync(reconciledDeepWorkItems);
hooks/useBrainDumpData.ts:2062:        saveAndSync(updated);
hooks/useBrainDumpData.ts:2094:        saveAndSync(updated);
hooks/useBrainDumpData.ts:2112:        saveAndSync(updated);
hooks/useBrainDumpData.ts:2190:        saveAndSync(updated, undefined, undefined, undefined, updatedWallets);
hooks/useBrainDumpData.ts:2236:        saveAndSync(updated);
hooks/useBrainDumpData.ts:2268:        saveAndSync(updated);
hooks/useBrainDumpData.ts:2302:        saveAndSync(updated);
hooks/useBrainDumpData.ts:2325:        pendingReviews,
hooks/useBrainDumpData.ts:2330:        saveAndSync,
services/insightService.ts:254:    const response = await withAiRetry(() => ai.models.generateContent({
services/__tests__/canonicalizerService.test.ts:4:import { canonicalizeMeta, canonicalizeParserResults, learnCanonicalRulesFromReview, sweepHistoricalCanonicalMeta } from '../canonicalizerService';
services/__tests__/canonicalizerService.test.ts:5:import { BrainDumpItem, CanonicalRule, ItemType, ParserResultV2 } from '../../types';
services/__tests__/canonicalizerService.test.ts:76:test('canonicalizeParserResults annotates create_item results with canonical review metadata', () => {
services/__tests__/canonicalizerService.test.ts:77:  const parsed: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:93:  const next = canonicalizeParserResults(parsed, ctx);
services/__tests__/canonicalizerService.test.ts:103:  const approved: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:156:  const original: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:182:  const approved: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:239:  const approved: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:296:  const original: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:483:test('canonicalizeParserResults fills commodity fields from transaction behavior signals', () => {
services/__tests__/canonicalizerService.test.ts:484:  const parsed: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:503:  const next = canonicalizeParserResults(parsed, ctx);
services/__tests__/canonicalizerService.test.ts:512:test('canonicalizeParserResults does not infer spend commodity for non-money notes', () => {
services/__tests__/canonicalizerService.test.ts:513:  const parsed: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:531:  const next = canonicalizeParserResults(parsed, ctx);
services/__tests__/canonicalizerService.test.ts:587:  const original: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:649:  const approved: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:684:test('canonicalizeParserResults reuses high-confidence behavior for wallet budget and commodity metadata', () => {
services/__tests__/canonicalizerService.test.ts:725:  const parsed: ParserResultV2[] = [
services/__tests__/canonicalizerService.test.ts:745:  const next = canonicalizeParserResults(parsed, behaviorCtx);
services/__tests__/canonicalizerService.test.ts:805:  const weakParsed = canonicalizeParserResults([{
services/__tests__/canonicalizerService.test.ts:817:  const splitParsed = canonicalizeParserResults([{
services/__tests__/canonicalizerService.test.ts:865:  const next = canonicalizeParserResults([{
services/__tests__/parserRouter.test.ts:4:import { classifyLocalIntent, PARSER_ROUTER_THRESHOLDS, routeParserInput } from '../parserRouter';
services/__tests__/parserRouter.test.ts:45:  const routed = await routeParserInput('transfer 250rb dari bca ke cash', ctx, async () => {
services/__tests__/parserRouter.test.ts:59:  const routed = await routeParserInput('beli susu besok 12rb', ctx, async () => []);
services/__tests__/parserRouter.test.ts:68:  const routed = await routeParserInput('saving 500rb vacation dari bca', ctx, async () => []);
services/__tests__/parserRouter.test.ts:78:  const routed = await routeParserInput('expense sarapan 14000 cash; beli susu besok 12rb', ctx, async () => {
services/__tests__/parserRouter.test.ts:90:  const classified = classifyLocalIntent('berapa pengeluaran hari ini?', ctx);
services/__tests__/parserSignalService.test.ts:4:import { canonicalizeParserResults } from '../canonicalizerService';
services/__tests__/parserSignalService.test.ts:7:import { BudgetRule, ParserResultV2, Wallet } from '../../types';
services/__tests__/parserSignalService.test.ts:99:  const parsed: ParserResultV2[] = [{
services/__tests__/parserSignalService.test.ts:111:  const result = canonicalizeParserResults(parsed, {
services/__tests__/aiFeatureFallbacks.test.ts:5:import { classifyText } from '../geminiService';
services/__tests__/aiFeatureFallbacks.test.ts:6:import { parsePro } from '../geminiProService';
services/__tests__/aiFeatureFallbacks.test.ts:19:    const classified = await classifyText('beli susu');
services/__tests__/aiFeatureFallbacks.test.ts:28:    const pro = await parsePro('bayar listrik');
services/chatService.ts:58:        const response = await withAiRetry(() => ai.models.generateContent({
services/geminiService.ts:119:export const classifyText = async (
services/geminiService.ts:153:    const response = await withAiRetry(() => ai.models.generateContent({
services/geminiService.ts:251:      return classifyText(text, existingTags, availableSkills, retryCount + 1, customPrompt, parsingModel, availableWallets, availableBudgetRules);
services/geminiProService.ts:10:  ParserResultV2,
services/geminiProService.ts:708:): Promise<ParserResultV2[]> {
services/geminiProService.ts:709:  const response = await withAiRetry(() => ai.models.generateContent({
services/geminiProService.ts:738:  return arr.map((item: any): ParserResultV2 => ({
services/geminiProService.ts:751:  stage1Results: ParserResultV2[],
services/geminiProService.ts:841:  stage1Results: ParserResultV2[],
services/geminiProService.ts:844:): Promise<ParserResultV2[]> {
services/geminiProService.ts:845:  const response = await withAiRetry(() => ai.models.generateContent({
services/geminiProService.ts:859:  return arr.map((item: any): ParserResultV2 => ({
services/geminiProService.ts:886:function resolveAndValidateResults(stage2Results: ParserResultV2[], ctx: ParserContext, rawText = ''): ParserResultV2[] {
services/geminiProService.ts:888:    const resolved: ParserResultV2 = {
services/geminiProService.ts:1302:export const parsePro = async (
services/geminiProService.ts:1313:): Promise<ParserResultV2[]> => {
services/geminiProService.ts:1356:      return parsePro(
services/geminiProService.ts:1383:export default parsePro;
services/parserRouter.ts:6:  ParserResultV2,
services/parserRouter.ts:7:  ParserRouterDecisionMetadata,
services/parserRouter.ts:12:import { parseLocalFinanceCommand } from './localFinanceParser';
services/parserRouter.ts:29:type LocalClassification = ParserRouterDecisionMetadata & { result?: ParserResultV2 };
services/parserRouter.ts:30:export type ParserRouterOutput = { decision: ParserRouterDecisionMetadata; results: ParserResultV2[] };
services/parserRouter.ts:37:const confidenceLabel = (score: number): ParserResultV2['confidence'] => {
services/parserRouter.ts:48:const decision = (intent: ParserIntent, confidenceScore: number, reasonCodes: string[], result?: ParserResultV2): LocalClassification => ({
services/parserRouter.ts:56:const intentToEntity = (intent: ParserIntent): ParserResultV2['entityType'] => {
services/parserRouter.ts:119:  entityType: ParserResultV2['entityType'],
services/parserRouter.ts:124:): ParserResultV2 => ({
services/parserRouter.ts:193:export const classifyLocalIntent = (rawText: string, ctx: LocalClassifierContext = {}): LocalClassification => {
services/parserRouter.ts:211:  const localFinance = parseLocalFinanceCommand(normalized, ctx);
services/parserRouter.ts:232:export const routeParserInput = async (
services/parserRouter.ts:235:  deepParser: () => Promise<ParserResultV2[]>,
services/parserRouter.ts:237:  const local = classifyLocalIntent(text, ctx);
services/canonicalizerService.ts:10:  ParserResultV2,
services/canonicalizerService.ts:39:  results: ParserResultV2[];
services/canonicalizerService.ts:40:  originalResults: ParserResultV2[];
services/canonicalizerService.ts:51:const getPayloadMeta = (result: ParserResultV2): ParsedItemMetaV2 | undefined => {
services/canonicalizerService.ts:178:  const resultBase: Omit<ParserResultV2, 'payload'> = {
services/canonicalizerService.ts:265:  result: ParserResultV2,
services/canonicalizerService.ts:284:export function canonicalizeParserResults(
services/canonicalizerService.ts:285:  results: ParserResultV2[],
services/canonicalizerService.ts:287:): ParserResultV2[] {
services/canonicalizerService.ts:296:      const nextResult: ParserResultV2 = {
services/canonicalizerService.ts:323:      const nextResult: ParserResultV2 = {
services/canonicalizerService.ts:418:  originalResults: ParserResultV2[];
services/canonicalizerService.ts:419:  approvedResults: ParserResultV2[];
services/localFinanceParser.ts:9:  ParserResultV2,
services/localFinanceParser.ts:30:  result: ParserResultV2;
services/localFinanceParser.ts:236:export const parseLocalFinanceCommand = (text: string, options: LocalFinanceParseOptions = {}): LocalFinanceParseResult | null => {
services/localFinanceParser.ts:269:  let result: ParserResultV2;
services/localFinanceParser.ts:311:export const parseLocalFinanceResults = (text: string, options: LocalFinanceParseOptions = {}): ParserResultV2[] | null => {
services/localFinanceParser.ts:312:  const parsed = parseLocalFinanceCommand(text, options);
utils/__tests__/parserResultGuards.test.ts:4:import { guardParserResultMultiplicity } from '../parserResultGuards';
utils/__tests__/parserResultGuards.test.ts:5:import { ParserResultV2 } from '../../types';
utils/__tests__/parserResultGuards.test.ts:7:const expenseResult = (overrides: Partial<ParserResultV2> = {}): ParserResultV2 => ({
utils/__tests__/parserResultGuards.test.ts:29:  const guarded = guardParserResultMultiplicity(duplicated, 'expense: beli calliper 10000 gopaylater');
utils/__tests__/parserResultGuards.test.ts:38:  const guarded = guardParserResultMultiplicity([
utils/__tests__/parserResultGuards.test.ts:48:  const guarded = guardParserResultMultiplicity([
utils/parserResultGuards.ts:1:import { ParserResultV2, CreateItemPayload } from '../types';
utils/parserResultGuards.ts:18:const parserResultSignature = (result: ParserResultV2): string => stableStringify({
utils/parserResultGuards.ts:27:const isCreateFinanceResult = (result: ParserResultV2): boolean => {
utils/parserResultGuards.ts:33:const financeCoreSignature = (result: ParserResultV2): string => {
utils/parserResultGuards.ts:47:const financeLooseSingleInputSignature = (result: ParserResultV2): string => {
utils/parserResultGuards.ts:59:const scoreFinanceResult = (result: ParserResultV2): number => {
utils/parserResultGuards.ts:87:  results: ParserResultV2[];
utils/parserResultGuards.ts:92:export function guardParserResultMultiplicity(results: ParserResultV2[], sourceText: string): ParserMultiplicityGuardResult {
utils/parserResultGuards.ts:94:  const deduped: ParserResultV2[] = [];
components/ControlCenter.tsx:11:import { SyncStatus, AppSettings, BudgetConfig, BudgetRule, BrainDumpItem, Skill, Wallet, CanonicalRule, ParserResultV2 } from '../types';
components/ControlCenter.tsx:28:    pendingReviews?: { id: string; text: string; results: ParserResultV2[] }[];
components/ControlCenter.tsx:88:    isOpen, onClose, saveStatus, fetchStatus, onSyncClick, onRefreshClick, onRunCanonicalBackfill, canonicalRules = [], pendingReviews = [], onToggleCanonicalRuleDisabled,
components/ControlCenter.tsx:109:    const pendingCanonicalSuggestionCount = pendingReviews.reduce((sum, review) =>
components/ControlCenter.tsx:652:                                                                checked={localAppSettings.enableDraftReview ?? false}
components/ControlCenter.tsx:653:                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, enableDraftReview: e.target.checked })}
components/__tests__/reviewCenterParserDetails.test.tsx:6:import ReviewCenterPanel from '../ReviewCenterPanel';
components/__tests__/reviewCenterParserDetails.test.tsx:7:import PendingReviewList from '../PendingReviewList';
components/__tests__/reviewCenterParserDetails.test.tsx:8:import { ParserResultV2, ParsingTask } from '../../types';
components/__tests__/reviewCenterParserDetails.test.tsx:10:const localFinanceResult: ParserResultV2 = {
components/__tests__/reviewCenterParserDetails.test.tsx:44:  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, { parsingTasks: [task] }));
components/__tests__/reviewCenterParserDetails.test.tsx:55:  const html = renderToStaticMarkup(React.createElement(PendingReviewList, {
components/ReviewCenterPanel.tsx:3:import PendingReviewList from './PendingReviewList';
components/ReviewCenterPanel.tsx:5:  ParserResultV2,
components/ReviewCenterPanel.tsx:17:interface ReviewCenterPanelProps {
components/ReviewCenterPanel.tsx:19:  pendingReviews?: { id: string; text: string; results: ParserResultV2[] }[];
components/ReviewCenterPanel.tsx:20:  onApproveReview?: (id: string, updatedResults: ParserResultV2[]) => void;
components/ReviewCenterPanel.tsx:37:const createsSavedEntry = (result: ParserResultV2) => (
components/ReviewCenterPanel.tsx:44:const actionDestination = (result: ParserResultV2) => {
components/ReviewCenterPanel.tsx:85:const resultAttributes = (result: ParserResultV2): Array<[string, string]> => {
components/ReviewCenterPanel.tsx:134:const ParsingResultDetails: React.FC<{ result: ParserResultV2; index?: number }> = ({ result, index = 0 }) => {
components/ReviewCenterPanel.tsx:178:const ReviewCenterPanel: React.FC<ReviewCenterPanelProps> = ({
components/ReviewCenterPanel.tsx:180:  pendingReviews = [],
components/ReviewCenterPanel.tsx:189:  const hasPendingReviews = pendingReviews.length > 0;
components/ReviewCenterPanel.tsx:297:        <PendingReviewList
components/ReviewCenterPanel.tsx:298:          reviews={pendingReviews}
components/ReviewCenterPanel.tsx:317:export default ReviewCenterPanel;
components/views/SummaryView.tsx:57:import ReviewCenterPanel from '../ReviewCenterPanel';
components/views/SummaryView.tsx:113:    pendingReviews?: { id: string; text: string; results: any[] }[];
components/views/SummaryView.tsx:162:    pendingReviews = [],
components/views/SummaryView.tsx:846:                                {((pendingReviews && pendingReviews.length > 0) || (parsingTasks && parsingTasks.length > 0)) && (
components/views/SummaryView.tsx:1220:                                                {pendingReviews && pendingReviews.length > 0 && (
components/views/SummaryView.tsx:1222:                                                        {pendingReviews.length} Pending
components/views/SummaryView.tsx:1234:                                        <ReviewCenterPanel
components/views/SummaryView.tsx:1236:                                            pendingReviews={pendingReviews}
components/PendingReviewList.tsx:4:import { CanonicalReviewSuggestion, ParserResultV2, ParserEntityType } from '../types';
components/PendingReviewList.tsx:6:interface PendingReviewListProps {
components/PendingReviewList.tsx:7:  reviews: { id: string; text: string; results: ParserResultV2[] }[];
components/PendingReviewList.tsx:8:  onApprove: (id: string, updatedResults: ParserResultV2[]) => void;
components/PendingReviewList.tsx:12:const PendingReviewList: React.FC<PendingReviewListProps> = ({ reviews, onApprove, onReject }) => {
components/PendingReviewList.tsx:32:  review: { id: string; text: string; results: ParserResultV2[] };
components/PendingReviewList.tsx:33:  onApprove: (id: string, updatedResults: ParserResultV2[]) => void;
components/PendingReviewList.tsx:416:export default PendingReviewList;
App.tsx:32:import ReviewCenterPanel from './components/ReviewCenterPanel';
App.tsx:40:import { classifyText } from './services/geminiService';
App.tsx:48:      loading, error, pendingCount, parsingTasks, pendingReviews, canonicalRules, saveStatus, fetchStatus, saveAndSync, handleSend, handleToggleStatus,
App.tsx:136:  const reviewCenterBadgeCount = pendingReviews.length + parsingTasks.length;
App.tsx:444:          saveAndSync(items, newBudgetConfig, newPrompt, skills, wallets, monthlyThemes, newAppSettings);
App.tsx:457:      saveAndSync(items, undefined, undefined, undefined, undefined, newThemes);
App.tsx:465:          saveAndSync(items, undefined, undefined, updated, wallets, monthlyThemes);
App.tsx:469:          saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
App.tsx:494:                  saveAndSync(
App.tsx:517:      await saveAndSync([], undefined, undefined, [], [], {}, undefined, undefined, true);
App.tsx:536:          saveAndSync(items, undefined, undefined, updated, wallets, monthlyThemes);
App.tsx:540:          saveAndSync(items, undefined, undefined, updated, wallets, monthlyThemes);
App.tsx:551:          saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
App.tsx:555:          saveAndSync(items, undefined, undefined, skills, updated, monthlyThemes);
App.tsx:615:    saveAndSync(
App.tsx:630:    const parsed = await classifyText(
App.tsx:692:        onSyncClick={() => saveAndSync(items)}
App.tsx:720:                          pendingReviews={pendingReviews}
App.tsx:905:        onSyncClick={(forceOverwrite) => saveAndSync(items, undefined, undefined, undefined, undefined, undefined, undefined, undefined, forceOverwrite)}
App.tsx:909:        pendingReviews={pendingReviews}
App.tsx:958:                    {pendingReviews.length > 0 && (
App.tsx:960:                        {pendingReviews.length} Pending
App.tsx:977:                <ReviewCenterPanel
App.tsx:979:                  pendingReviews={pendingReviews}
types.ts:37:export interface ParserRouterDecisionMetadata {
types.ts:50:  results?: ParserResultV2[];
types.ts:51:  routerDecision?: ParserRouterDecisionMetadata;
types.ts:64:  enableDraftReview?: boolean;
types.ts:648:export interface ParserResultV2 {
```

## Files inspected for NDX-001
- hooks/useBrainDumpData.ts
- services/parserRouter.ts
- services/localFinanceParser.ts
- services/geminiService.ts
- services/geminiProService.ts
- services/canonicalizerService.ts
- utils/parserResultGuards.ts
- components/ReviewCenterPanel.tsx
- components/PendingReviewList.tsx
- types.ts

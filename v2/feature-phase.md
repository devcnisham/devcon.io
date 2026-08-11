# feature-phase.md

Source: owner's message, 2026-08-11. Transcribed as given. Gaps in the source
numbering are marked `[missing in source]` rather than invented — see
**Transcription notes** at the bottom.

Don't build the feature list randomly. Build the product in a dependency-aware
sequence so that every phase produces something usable and you can eventually go
end-to-end: project → build → ship → deploy → monitor.

## End-to-end build order

---

### PHASE 0 — Product Foundation

Build the platform itself.

1. Authentication
2. User profile
3. Workspace
4. Project creation
5. Project list
6. Project settings
7. Basic dashboard

**Result:** A user can create and manage a project.

---

### PHASE 1 — Project Import & Codebase

Now make the platform understand real projects.

8. Local project/folder import
9. GitHub repository import
10. Codebase scanner
11. File/folder analyzer
12. package/dependency analyzer
13. Language detection
14. Framework detection
15. Runtime detection
16. Database detection
17. ORM detection
18. UI/styling detection
19. Testing framework detection
20. CI/CD detection
21. Deployment detection
22. Environment/config detection

**Result**

```
User connects:
  my-project/
and your platform says:
  "I understand your project."
```

---

### PHASE 2 — Project Intelligence

Turn raw scanning into understanding.

23. Technology map
24. Folder structure map
25. Architecture detection
26. Frontend detection
27. Backend detection
28. API detection
29. Database detection
30. Authentication detection
31. Storage detection
32. Existing feature detection
33. Existing implementation detection
34. Project-state detection
35. Project completeness
36. Project explainer

**Result**

> "This is a Next.js + Supabase application. Authentication and dashboard are
> complete. Testing and CI/CD are missing."

---

### PHASE 3 — Project Roadmap Engine

Now turn understanding into a plan.

37. Development lifecycle
38. Roadmap engine
39. Phase generation
40. Task generation
41. Task dependencies
42. Milestones
43. Feature roadmap
44. Project progress
45. Completion percentage
46. Blocker detection
47. Next-step engine
48. "What should I do next?"

**Result**

```
PROJECT ROADMAP

✓ Setup
✓ Architecture
✓ Database
○ Testing
○ CI/CD
○ Deployment
○ Production
```

---

### PHASE 4 — Documentation Engine

Now make every step understandable.

49. Documentation system
50. Official documentation sources
51. Documentation search
52. Technology documentation mapping
53. Step → documentation mapping
54. Contextual documentation
55. "What is this?"
56. "Why do I need this?"
57. "How does this work?"
58. Implementation guide
59. Verification guide

**Result** — every roadmap step has:

```
WHAT
WHY
HOW
OFFICIAL DOCS
IMPLEMENTATION
VERIFY
NEXT
```

---

### PHASE 5 — Guided Development

Now turn the roadmap into an actual development system.

60. Step-by-step workflow
61. Development phases
62. Interactive checklist
63. Step completion
64. Step verification
65. Task status
66. Task dependencies
67. Feature workflow
68. Milestone workflow
69. Blocker handling
70. Build guides
71. Development recipes

**Result** — the user can literally follow:

```
Step 1 → Complete → Verify
Step 2 → Complete → Verify
Step 3
```

---

### PHASE 6 — Core Integrations

Start with only three.

**GitHub**

72. GitHub OAuth
73. Repository connection
74. Repository detection
75. Branches
76. Commits
77. Pull requests
78. Issues
79. GitHub Actions
80. GitHub activity

**Supabase**

81. Supabase OAuth/API connection
82. Project detection
83. Database
84. Schema
85. Migrations
86. Auth
87. Storage
88. Database health

**Vercel**

89. Vercel connection
90. Project detection
91. Deployments
92. Builds
93. Preview deployments
94. Production deployment
95. Domains
96. Environment configuration

**Result:** the platform now knows what is happening across the user's
development stack.

---

### PHASE 7 — Development Workflow

Now connect development with those integrations.

97. Git workflow
98. Branch workflow
99. Commit workflow
100. Push workflow
101. Pull request workflow
102. Code review workflow
103. Database workflow
104. API workflow
105. Environment workflow
106. Feature workflow

**Result**

```
Feature → Branch → Code → Commit → Push → PR
```

---

### PHASE 8 — Testing

Now build the test detection.

107. `[missing in source]`
108. Unit tests
109. Integration tests
110. E2E tests
111. API tests
112. Test execution
113. Test results
114. Test coverage
115. Lint
116. Type checking
117. Build checking
118. Testing readiness

**Result**

```
✓ Tests passed
✓ TypeScript passed
✓ Lint passed
✓ Build passed

READY FOR CI
```

---

### PHASE 9 — CI/CD

Now automate the pipeline.

119. CI pipeline
120. Install
121. Lint
122. Type check
123. Unit tests
124. Integration tests
125. E2E tests
126. Build
127. Security checks
128. Preview deployment
129. Production deployment
130. Pipeline status
131. Pipeline failures

**Result** — the pipeline becomes:

```
CODE → COMMIT → PUSH → CI → TEST → BUILD → PREVIEW
```

---

### PHASE 10 — Preview + QA

Now create the quality gate.

132. Preview environment
133. Preview tracking
134. QA checklist
135. Feature verification
136. Manual verification
137. Automated verification
138. Bug reporting
139. Issue tracking
140. QA approval

**Workflow**

```
CODE → CI → PREVIEW → QA → APPROVED
```

---

### PHASE 11 — Production Readiness

Before production:

141. Production checklist
142. Security checklist
143. Environment validation
144. Database validation
145. Backup validation
146. Domain validation
147. HTTPS validation
148. Rate-limit validation
149. Monitoring validation
150. Testing validation
151. Production readiness score

**Example**

```
Production Readiness: 94%

✓ Security
✓ Database
✓ Environment
✓ Testing
✓ Monitoring
✓ Domain

READY FOR PRODUCTION
```

---

### PHASE 12 — Production Deployment

Now complete the first true end-to-end journey.

152. Production deployment
153. Deployment tracking
154. Deployment history
155. Build status
156. Deployment logs
157. Rollback
158. Redeploy
159. Domain tracking
160. Production status

**Final workflow**

```
IDEA → PLAN → BUILD → TEST → CI → PREVIEW → QA → PRODUCTION 🚀
```

This is the first major milestone.

---

### PHASE 13 — Monitoring

Now the product continues after deployment.

161. Monitoring
162. Error monitoring
163. Performance monitoring
164. Uptime
165. Logs
166. `[missing in source]`
167. `[missing in source]`
168. Alerts
169. Production health

---

### PHASE 14 — Project Health

Now calculate the state of the entire project.

170. Project health engine
171. Code quality score
172. Security score
173. Testing score
174. Performance score
175. Deployment score
176. Documentation score
177. Dependency score
178. Monitoring score
179. Overall project health
180. Recommendations

---

### PHASE 15 — Dependency & Security Intelligence

181. Dependency scanning
182. Outdated package detection
183. Vulnerability detection
184. Deprecated package detection
185. Dependency conflicts
186. Update recommendations
187. Security checks
188. Security recommendations

---

### PHASE 16 — Environment Management

189. Environment detection
190. Development environment
191. Preview environment
192. Production environment
193. Environment comparison
194. Missing variable detection
195. Configuration validation
196. Environment documentation

---

### PHASE 17 — Feature → Code → Ship Tracking

Now connect everything together.

197. Feature requirements
198. `[missing in source]`
199. Feature tasks
200. Feature code mapping
201. Feature commits
202. Feature PRs
203. Feature tests
204. Feature deployments
205. Feature production status

So:

```
FEATURE → TASK → CODE → COMMIT → PR → TEST → DEPLOY → PRODUCTION
```

---

### PHASE 18 — Releases

206. Release management
207. Release checklist
208. Release readiness
209. Versioning
210. Changelog
211. Release notes
212. Git tags
213. GitHub releases
214. Release history

---

### PHASE 19 — AI Assistant

Only after the underlying system works.

215. AI project assistant
216. Project Q&A
217. Codebase Q&A
218. AI roadmap generation
219. AI planning
220. AI architecture advisor
221. AI documentation assistant
222. AI debugging
223. AI testing assistant
224. AI deployment assistant
225. AI recommendations
226. AI next-step engine

---

### PHASE 20 — AI Coding Agent

Then allow AI to actually execute work.

227. Build With Me
228. Code generation
229. Code modification
230. File creation
231. File modification
232. Refactoring
233. Bug fixing
234. `[missing in source]`
235. Branch creation
236. Commit creation
237. PR creation
238. Test execution
239. Preview deployment
240. Deployment assistance
241. Agent permissions
242. Production confirmation

---

### PHASE 21 — Debugging / Incident Management

243. Error detection
244. Console errors
245. Build errors
246. API errors
247. Deployment errors
248. Production errors
249. Error investigation
250. Root-cause analysis
251. Fix suggestions
252. Incident mode
253. Incident history

---

### PHASE 22 — Documentation Generation

254. README generation
255. Architecture documentation
256. API documentation
257. Setup documentation
258. Environment documentation
259. Deployment documentation
260. Feature documentation
261. Changelog generation

---

### PHASE 23 — Learning Layer

262. Contextual learning
263. Beginner explanations
264. Technology explanations
265. Architecture explanations
266. Git explanations
267. CI/CD explanations
268. Deployment explanations
269. Error explanations
270. "Why is this needed?"
271. "How do I do this?"

---

### PHASE 24 — Templates & Recipes

**Blueprints**

272. SaaS blueprint
273. Next.js blueprint
274. Next.js + Supabase
275. Next.js + Stripe
276. AI SaaS
277. API
278. Mobile app
279. E-commerce
280. Marketplace
281. Admin dashboard
282. Social app

**Recipes**

283. Authentication
284. Payments
285. Email
286. File uploads
287. Search
288. Notifications
289. Subscriptions
290. Webhooks
291. Cron jobs
292. Background jobs
293. AI features

---

### PHASE 25 — More Integrations

Only after the core system is proven.

294. GitLab
295. Bitbucket
296. AWS
297. Cloudflare
298. Netlify
299. Railway
300. Render
301. Firebase
302. Neon
303. PlanetScale
304. Stripe
305. Razorpay
306. Paddle
307. Sentry
308. PostHog
309. Better Stack
310. Datadog
311. Figma
312. Slack
313. Discord
314. Linear
315. Notion
316. Jira
317. Trello

---

### PHASE 26 — Team Mode

Later:

318. Team workspace
319. Team members
320. Roles
321. Permissions
322. Shared projects
323. Task assignment
324. Shared roadmap
325. Code review
326. QA assignment
327. Approvals
328. Team activity
329. Team analytics

---

## MVP boundary

Don't build all 329 items first. The first real MVP stops here:

```
PROJECT
  ↓
IMPORT CODEBASE
  ↓
SCAN
  ↓
DETECT STACK
  ↓
UNDERSTAND PROJECT
  ↓
GENERATE ROADMAP
  ↓
SHOW OFFICIAL DOCS
  ↓
GUIDE STEP-BY-STEP
  ↓
GITHUB → SUPABASE → VERCEL
  ↓
TEST → CI/CD → PREVIEW → QA → PRODUCTION
```

That is already a complete product.

Second major version adds:

```
MONITOR → PROJECT HEALTH → DEPENDENCY INTELLIGENCE → FEATURE TRACEABILITY → RELEASES
```

Then:

```
AI ASSISTANT → AI AGENT → AUTOMATION
```

Finally:

```
TEAM → MORE INTEGRATIONS → ADVANCED PLATFORM
```

---

## Transcription notes

The source message had numbering gaps and a few garbled lines. Nothing was
invented to fill them; each is marked inline above.

| Item | State in source |
|---|---|
| 107 | Number skipped — Phase 8 jumps 106 → 108 |
| 166, 167 | Source read `165. Logs` then a stray `h` then `168. Alerts` |
| 198 | Number skipped — Phase 17 jumps 197 → 199 |
| 234 | `Bug fixing` appeared unnumbered between 232 and 235; assigned 233, 234 left open |
| Phase 11 | Had no header in source — items 141–151 followed "Before production:". Titled **Production Readiness** here |
| Phase 6 | Header read `Core Integration ecosystem.` — normalised to **Core Integrations** |
| Phase 3 result | `✓ Dat` — completed to `✓ Database` |
| 271 | `"How do?"` — completed to `"How do I do this?"` |
| 327 | Ran into 328 as `Approva328. Team activity` — split to `Approvals` / `Team activity` |

**Status of every item above: not built.** This file is a plan, not a report. v2
today reads one local markdown file and has no auth, no database, no API, no
integrations. Item 1 has not started.

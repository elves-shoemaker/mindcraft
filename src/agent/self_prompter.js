const STOPPED = 0
const ACTIVE = 1
const PAUSED = 2
export class SelfPrompter {
    constructor(agent) {
        this.agent = agent;
        this.state = STOPPED;
        this.loop_active = false;
        this.interrupt = false;
        this.prompt = '';
        this.idle_time = 0;
        this.cooldown = 500;
    }

    start(prompt) {
        console.log('Self-prompting started.');
        if (!prompt) {
            if (!this.prompt)
                return 'No prompt specified. Ignoring request.';
            prompt = this.prompt;
        }
        this.state = ACTIVE;
        this.prompt = prompt;
        this.startLoop();
    }

    isActive() {
        return this.state === ACTIVE;
    }

    isStopped() {
        return this.state === STOPPED;
    }

    isPaused() {
        return this.state === PAUSED;
    }

    async handleLoad(prompt, state) {
        if (state == undefined)
            state = STOPPED;
        this.state = state;
        this.prompt = prompt;
        if (state !== STOPPED && !prompt)
            throw new Error('No prompt loaded when self-prompting is active');
        if (state === ACTIVE) {
            await this.start(prompt);
        }
    }

    setPromptPaused(prompt) {
        this.prompt = prompt;
        this.state = PAUSED;
    }

    async startLoop() {
        if (this.loop_active) {
            console.warn('Self-prompt loop is already active. Ignoring request.');
            return;
        }
        console.log('starting self-prompt loop')
        this.loop_active = true;

const RULES = `CRITICAL RULES (obey in order):
0. OXYGEN: If underwater, STOP all reasoning. Look UP, hold jump, swim up. Oxygen > Everything.
1. STUCK_EMERGENCY: If stuck for 30s, use !moveAway(100) to reset. Standing still is death.
2. HUNGER: If < 6, stop everything. Use !nearbyEntities to find ANY mob or break leaves for apples. Eat raw meat if needed.
3. INVENTORY IS TRUTH: Check !inventory first. Use what you HAVE to craft. If empty, you are Tier 0.
4. SMELTING & CRAFTING: 
   - RAW IRON: You cannot craft iron_ingot. You MUST use a furnace (!craftRecipe("furnace") with 8 cobblestone) to SMELT iron_ore/raw_iron.
   - USE WHAT YOU HAVE: If you have cobblestone, craft stone_pickaxe NOW. If you have planks, make sticks. Your inventory is the solution - don't search for things you already have!
5. MOVEMENT IS MINING: To go up, you MUST mine a path into the wall: move 1 block forward and break 1 block above your head level, creating a diagonal upward path. Repeat this to rise. NEVER search for "stairs" items.
6. NO APOLOGIES: Do not apologize or explain. Only output !commands. !collectBlocks is a VALID command for stone, dirt, and ores.
7. DIGGING IS FREE: Breaking blocks to create paths is ALWAYS allowed and required. Digging is your primary way to move!
8. CRAFTING: Logs -> Planks -> Sticks -> Tools. 
9. MILESTONES: Wood -> Stone -> Iron.`;

        // 補助メッセージ
        const craftingCheck = 'COMMAND INFO: Use !collectBlocks(block_name, count) to clear a path. To go up from underground, break blocks diagonally above you: 1 block forward for every 1 block you rise. This diagonal tunnel is your way out. Smelt iron_ore in a furnace to get iron_ingot.';

while (!this.interrupt) {
            const goals = [
                `Goal: '${this.prompt}'. ${RULES} ${craftingCheck} Now respond with !command:`,
                `Your goal: '${this.prompt}'. ${RULES} ${craftingCheck} Use !command now:`,
                `Act: '${this.prompt}'. ${RULES} ${craftingCheck} !command:`,
                `Initiative: '${this.prompt}'. ${RULES} ${craftingCheck} What !command?`,
            ];
            const msg = goals[Math.floor(Math.random() * goals.length)];
            
            let used_command = await this.agent.handleMessage('system', msg, -1);
            if (!used_command) {
                console.warn('No command used, retrying...');
            }
            await new Promise(r => setTimeout(r, this.cooldown));
        }
        console.log('self prompt loop stopped')
        this.loop_active = false;
        this.interrupt = false;
    }

    update(delta) {
        if (this.state === ACTIVE && !this.loop_active && !this.interrupt) {
            console.log('Restarting self-prompting...');
            this.startLoop();
        }
    }

    async stopLoop() {
        // you can call this without await if you don't need to wait for it to finish
        if (this.interrupt)
            return;
        console.log('stopping self-prompt loop')
        this.interrupt = true;
        while (this.loop_active) {
            await new Promise(r => setTimeout(r, 500));
        }
        this.interrupt = false;
    }

    async stop(stop_action=true) {
        this.interrupt = true;
        if (stop_action)
            await this.agent.actions.stop();
        this.stopLoop();
        this.state = STOPPED;
    }

    async pause() {
        this.interrupt = true;
        await this.agent.actions.stop();
        this.stopLoop();
        this.state = PAUSED;
    }

    shouldInterrupt(is_self_prompt) { // to be called from handleMessage
        return is_self_prompt && (this.state === ACTIVE || this.state === PAUSED) && this.interrupt;
    }

    handleUserPromptedCmd(is_self_prompt, is_action) {
        // if a user messages and the bot responds with an action, stop the self-prompt loop
        if (!is_self_prompt && is_action) {
            this.stopLoop();
            // this stops it from responding from the handlemessage loop and the self-prompt loop at the same time
        }
    }
}
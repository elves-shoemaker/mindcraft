const STOPPED = 0
const ACTIVE = 1
const PAUSED = 2

let policyContent = '';
try {
    policyContent = require('fs').readFileSync('./bots/policy.md', 'utf8');
} catch (e) {
    policyContent = '';
}

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
        while (!this.interrupt) {
            const policyPrefix = policyContent ? `【ポリシー】\n${policyContent}\n\n` : '';
            const goals = [
                `You are self-prompting with the goal: '${this.prompt}'. ${policyPrefix}Your next response MUST contain a command with this syntax: !commandName. Be creative and act freely! Respond:`,
                `You are autonomously exploring and surviving. Goal: '${this.prompt}'. ${policyPrefix}Pick any useful action and use a command now! Respond:`,
                `Act now! You're in a Minecraft world with goal: '${this.prompt}'. ${policyPrefix}Use a command to do something useful. Respond:`,
                `Don't wait! Take initiative. Your goal: '${this.prompt}'. ${policyPrefix}What will you do? Use a command! Respond:`,
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
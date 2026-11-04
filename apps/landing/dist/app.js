const examples = {
  commercial: { title: 'A habit tracker, without the detours.', steps: [['Define the one core habit loop', 'Choose the smallest version worth using.'], ['Shape your data model', 'Start with habits and daily check-ins.'], ['Build the daily check-in', 'Make one useful flow work end to end.'], ['Put it in someone’s hands', 'Get feedback before adding more features.']], omitted: [['Microservices', 'One app doesn’t need distributed services.'], ['Feature flags', 'There are no user cohorts to manage yet.'], ['Analytics dashboards', 'Start with real conversations, before traffic.']] },
  academic: { title: 'A course project with a clear purpose.', steps: [['Define your learning objective', 'Connect the project to the course requirements.'], ['Outline the system and data', 'Explain the decisions you want to demonstrate.'], ['Build a working core flow', 'Make the required behavior easy to evaluate.'], ['Document and demonstrate', 'Show the result, the decisions, and the limitations.']], omitted: [['Subscription billing', 'The project isn’t selling a paid service.'], ['Multi-region deployment', 'A single demonstration environment is enough.'], ['Growth analytics', 'Your goal is learning, not acquisition.']] },
  competition: { title: 'A hackathon idea that makes the deadline.', steps: [['Pin down the demo moment', 'Choose the one thing judges should remember.'], ['Use the simplest working stack', 'Keep setup time small and dependencies familiar.'], ['Build the core experience', 'Prioritize one complete path through the product.'], ['Rehearse the demonstration', 'Prepare your story and a fallback for the demo.']], omitted: [['A full design system', 'A small demo needs a consistent interface first.'], ['A platform migration', 'Spend your limited time on the core experience.'], ['Background job infrastructure', 'Add it only if the demo needs background work.']] }
};
const tabs = [...document.querySelectorAll('[role="tab"]')];
const toggle = document.querySelector('#omissions-toggle');
const omissions = document.querySelector('#omissions');
function render(context) {
  const example = examples[context];
  tabs.forEach(tab => { const active = tab.dataset.context === context; tab.setAttribute('aria-selected', active); tab.tabIndex = active ? 0 : -1; });
  document.querySelector('#plan-panel').setAttribute('aria-labelledby', `tab-${context}`);
  document.querySelector('.interactive-plan-header > span:first-child').innerHTML = `<span class="agent-icon">✳</span> ${example.title}`;
  document.querySelector('#dynamic-steps').innerHTML = example.steps.map(([title, description], index) => `<div class="dynamic-step"><span>0${index + 1}</span><div><h4>${title}</h4><p>${description}</p></div><span>↗</span></div>`).join('');
  omissions.innerHTML = example.omitted.map(([title, reason]) => `<div class="omitted-step"><s>${title}</s><small>${reason}</small></div>`).join('');
  document.querySelector('#omission-count').textContent = example.omitted.length;
  omissions.hidden = true; toggle.setAttribute('aria-expanded', 'false'); document.querySelector('#toggle-symbol').textContent = '+';
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => render(tab.dataset.context));
  tab.addEventListener('keydown', event => {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); render(tabs[next].dataset.context); tabs[next].focus();
  });
});
toggle.addEventListener('click', () => { const expanded = toggle.getAttribute('aria-expanded') !== 'true'; omissions.hidden = !expanded; toggle.setAttribute('aria-expanded', expanded); document.querySelector('#toggle-symbol').textContent = expanded ? '−' : '+'; });
document.querySelector('#copy-prompt').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try { await navigator.clipboard.writeText(document.querySelector('#prompt-text').textContent); status.textContent = 'Prompt copied. Ready for your coding agent.'; }
  catch { status.textContent = 'Copy isn’t available here. Select the prompt text above to copy it.'; }
});
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
function closeMenu() { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); menu.setAttribute('aria-label', 'Open navigation'); }
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', open); nav.classList.toggle('is-open', open); menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); });
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
document.querySelector('#year').textContent = new Date().getFullYear();
render('commercial');

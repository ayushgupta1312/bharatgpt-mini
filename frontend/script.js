function addMessage(text, type) {
  const div = document.createElement('div');
  div.className = 'message ' + type;
  div.innerText = text;
  const chat = document.getElementById('chat');
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function askAI() {
  const input = document.getElementById('question');
  const question = input.value.trim();
  const mode = document.getElementById('mode').value;
  if (!question) return;

  addMessage(question, 'user');
  input.value = '';

  // Animated thinking indicator
  const loading = document.createElement('div');
  loading.className = 'message bot thinking';
  loading.innerHTML = '<span></span><span></span><span></span>';
  document.getElementById('chat').appendChild(loading);
  document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;

  const res = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, mode })
  });
  const data = await res.json();
  loading.remove();
  addMessage(data.answer, 'bot');
}

// Enter to send
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('question').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askAI();
    }
  });
});

document.addEventListener('DOMContentLoaded', function() {
  try {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
  } catch (e) {}

  function bindToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!(input && toggle)) return;
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = `<i class="fa ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
    });
  }

  bindToggle('id_password1', 'togglePwd1');
  bindToggle('id_password2', 'togglePwd2');

  const pwd1 = document.getElementById('id_password1');
  const pwd2 = document.getElementById('id_password2');
  const requirements = document.getElementById('passwordRequirements');
  const matchIndicator = document.getElementById('passwordMatch');

  if (pwd1 && pwd2 && requirements) {
    const reqMap = {
      length: value => value.length >= 8,
      upper: value => /[A-ZÁÉÍÓÚÑ]/.test(value),
      number: value => /\d/.test(value),
      symbol: value => /[^A-Za-z0-9]/.test(value),
    };

    const updateRequirements = value => {
      Object.keys(reqMap).forEach(key => {
        const item = requirements.querySelector(`[data-req="${key}"]`);
        if (!item) return;
        const met = reqMap[key](value);
        item.classList.toggle('requirement--met', met);
        item.querySelector('i').className = met ? 'fa fa-check-circle' : 'fa fa-circle';
      });
    };

    const updateMatch = () => {
      if (!pwd2.value) {
        matchIndicator.textContent = '';
        matchIndicator.className = 'match-indicator';
        return;
      }
      const match = pwd1.value && pwd1.value === pwd2.value;
      matchIndicator.textContent = match ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.';
      matchIndicator.className = match ? 'match-indicator match-indicator--ok' : 'match-indicator match-indicator--error';
    };

    ['input', 'change'].forEach(evt => {
      pwd1.addEventListener(evt, () => {
        updateRequirements(pwd1.value);
        updateMatch();
      });
      pwd2.addEventListener(evt, updateMatch);
    });

    updateRequirements(pwd1.value || '');
  }

  const form = document.getElementById('signupForm');
  if (form && pwd1 && pwd2) {
    form.addEventListener('submit', event => {
      const value = pwd1.value;
      const allMet = Object.values({
        length: value.length >= 8,
        upper: /[A-ZÁÉÍÓÚÑ]/.test(value),
        number: /\d/.test(value),
        symbol: /[^A-Za-z0-9]/.test(value),
      }).every(Boolean);
      if (!allMet || value !== pwd2.value) {
        event.preventDefault();
        form.classList.add('form-invalid');
      }
    });
  }
});
<script setup>
import 'vite/modulepreload-polyfill'
import { onMounted, ref } from 'vue'

var password = ref('');
var loginResult = ref('');
var inputDisabled = ref(false);

onMounted(() => {
  let colorSchemeMatchMedia = window.matchMedia('(prefers-color-scheme: dark)');

  colorSchemeMatchMedia.addEventListener('change',({ matches }) => {
    if (matches) {
      document.querySelector('html').setAttribute('data-bs-theme', "dark");
    } else {
      document.querySelector('html').setAttribute('data-bs-theme', "light");
    }
  });
  let userColorModePref = colorSchemeMatchMedia.matches ? "dark" : "light";
  document.querySelector('html').setAttribute('data-bs-theme', userColorModePref);
});

function loginWithPassword() {
  // inputDisabled.value = true;
  loginResult.value = '';
  if (password.value === '') {
    return;
  }
  fetch('/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'password': password.value
    })
  })
  .then(async (res) => {
    if (!res.ok) throw 'Invalid Password';
    let json = await res.json();
    if (!json || json.result === 'incorrect') throw 'Incorrect password.';
    else if (json.result === 'correct' && json.forward) {
      window.location.replace(json.forward);
      return "";
    }

    throw 'Error occurred with login.'
  }, () => { throw 'Error occurred with login.' })
  .catch((result) => {
    if (typeof result === "string") {
      loginResult.value = result;
    } else {
      loginResult.value = 'Error occurred';
    }
  })
  .finally(() => {
    inputDisabled.value = false;
  })
}
</script>

<template>
  <header>
    <title>Liar's Poker</title>
  </header>

  <main>
    <div class="d-flex justify-content-center align-items-center">
      <div class="container min-vh-100">
        <div class="row m-3 justify-content-center align-items-start">
          <h1 class="fw-bold">Liar's Poker For Da Boys</h1>
        </div>
        <form @submit.prevent="loginWithPassword" class="row my-3 align-items-start justify-content-center">
          <div class="col-4 offset-4">
            <input
              :class='{"is-invalid": loginResult !== "" }'
              :disabled="inputDisabled"
              class="form-control"
              placeholder="Enter Password"
              type="password"
              v-model="password"
              autocomplete="off"
              aria-describedby="validationResponse"
              required
            />
            <div id="validationResponse" class="invalid-feedback">{{ loginResult }}</div>
          </div>
          <div class="col-4">
            <input :disabled="inputDisabled" class="btn btn-primary" type="submit" value="Submit"/>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import detectColorMode from "/@/utilities/detect-color-mode.js";

detectColorMode();

let lobbies = ref({});

function getLobbies() {
  fetch('/lobby-list-json', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    body: null
  })
  .then(async (res) => {
    if (!res.ok) throw 'Invalid data';
    let json = await res.json();
    if (!json || typeof json !== 'object') throw 'Invalid data';
    lobbies.value = json;
  })
  .catch((error) => {
    if (error) console.error(error);
    lobbies.value = {};
  });
}

getLobbies();

</script>

<template>
  <main>
    <div class="d-flex justify-content-center align-items-center">
      <div class="container min-vh-100">
        <div class="row m-3 justify-content-center align-items-start">
          <h1 class="fw-bold">Liar's Poker</h1>
        </div>
        <div class="row m-3" v-if="Object.keys(lobbies).length === 0">
          <h2>
            No Lobbies!
          </h2>
        </div>
        <div class="row m-3" v-else>
          <ul class="list-group">
            <li class="list-group-item container-fluid" v-for="lobbyID of Object.keys(lobbies)" :key="lobbyID">
              <div class="d-flex flex-row justify-content-between align-items-center">
                <div class="fw-bold">{{ lobbyID }}</div>
                <a type="button" :href="`/lobby/${lobbyID}`" class="btn btn-success">Join</a>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </main>
</template>

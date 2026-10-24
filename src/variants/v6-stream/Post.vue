<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { txExplorerUrl, type ChainInfo } from '../../chains'
import type { Feedback } from '../../data/types'
import { formatDate, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import Sigil from '../shared/Sigil.vue'
import Score from './Score.vue'

// One review as a post: author → subject, score, text, replies.
defineProps<{ row: Feedback; chain: ChainInfo; author: RouteLocationRaw; subject?: { name: string; to: RouteLocationRaw }; badges?: { text: string; tone?: string }[] }>()
defineEmits<{ verify: [] }>()
</script>

<template>
  <article class="s-post" :class="{ revoked: row.revoked }">
    <Sigil :seed="row.client.toLowerCase()" :size="40" round :palette="['#1d9bf0', '#f91880', '#00ba7c', '#7856ff', '#ffad1f']" />
    <div class="body">
      <div class="who">
        <RouterLink :to="author"><b class="mono">{{ shortAddress(row.client) }}</b></RouterLink>
        <span v-if="subject">rated <RouterLink :to="subject.to">{{ subject.name }}</RouterLink></span>
        <span>· <span :title="row.createdAt ? formatDate(row.createdAt) : ''">{{ row.createdAt ? formatTimeline(row.createdAt) : 'undated' }}</span></span>
      </div>
      <div class="text">
        <Score :value="row.value" />
        <span v-if="row.tag1" class="s-badge" style="margin-left: 6px">#{{ row.tag1 }}</span>
        <span v-if="row.tag2" class="s-badge">#{{ row.tag2 }}</span>
        <span v-for="b in badges ?? []" :key="b.text" class="s-badge" :class="b.tone">{{ b.text }}</span>
        <span v-if="row.revoked" class="s-badge bad">deleted by author</span>
        <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" style="margin-top: 4px" />
      </div>
      <div v-for="(r, i) in row.responses ?? []" :key="i" class="s-reply">↳ reply from <span class="mono">{{ shortAddress(r.responder) }}</span><template v-if="r.createdAt"> · {{ formatTimeline(r.createdAt) }}</template></div>
      <div class="s-actions">
        <span>💬 {{ row.responses?.length ?? 0 }}</span>
        <a v-if="row.txHash" :href="txExplorerUrl(chain, row.txHash)" target="_blank" rel="noopener noreferrer">⛓ tx</a>
        <button type="button" @click="$emit('verify')">✓ verify</button>
      </div>
      <slot />
    </div>
  </article>
</template>

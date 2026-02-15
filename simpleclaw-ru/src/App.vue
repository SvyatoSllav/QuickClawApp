<template>
    <div class="flex flex-row w-screen overflow-x-hidden h-full justify-center px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 min-w-0">
        <div class="w-full max-w-5xl flex flex-col gap-0 min-w-0">

            <!-- Header -->
            <div class="w-full flex items-center justify-between gap-3 px-2 sm:px-0 py-2 sm:py-0 min-w-0">
                <span class="text-base sm:text-lg font-medium text-white truncate min-w-0 cursor-pointer" @click="goHome">
                    SimpleClaw.com <span class="text-zinc-400 italic">RU</span>
                </span>
                <div class="flex items-center gap-3 shrink-0">
                    <a href="mailto:tarasov.slavas2@gmail.com" class="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base border-b-2 border-white/20 text-zinc-400 hover:text-zinc-500 transition-colors duration-500 whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 sm:size-5 shrink-0">
                            <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" />
                        </svg>
                        Поддержка
                    </a>
                    <template v-if="isAuthenticated">
                        <div class="relative">
                            <button @click="showProfileDropdown = !showProfileDropdown" class="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.5625 17C17.269 17 17.7906 16.303 17.5242 15.662C16.288 12.698 13.3838 11 10 11C6.61691 11 3.71295 12.698 2.47658 15.662C2.21015 16.303 2.73178 17 3.43817 17H16.5625ZM6.08334 5C6.08334 2.794 7.91567 1 10 1C12.0843 1 13.9167 2.794 13.9167 5C13.9167 7.206 12.0843 9 10 9C7.91567 9 6.08334 7.206 6.08334 5Z" fill="#a1a1aa"/>
                                </svg>
                            </button>
                            <div v-if="showProfileDropdown" class="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-lg py-2 z-50">
                                <button @click="goToProfile" class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">Профиль</button>
                                <button @click="logout" class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">Выйти</button>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- SUCCESS PAGE after payment -->
            <template v-if="showSuccessPage">
                <div class="w-full px-4 sm:px-6 md:px-8 pt-16 sm:pt-24 pb-10 flex flex-col gap-6 text-center min-w-0">
                    <!-- Icon changes based on deploy completion -->
                    <div class="flex justify-center">
                        <div class="w-20 h-20 rounded-full flex items-center justify-center" :class="deployReady ? 'bg-emerald-500/20' : 'bg-blue-500/20'">
                            <svg v-if="deployReady" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400">
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 animate-spin" style="animation-duration: 2s;">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                        </div>
                    </div>

                    <h1 class="text-3xl sm:text-4xl font-bold text-white">
                        {{ deployReady ? 'Ваш бот готов!' : 'Настраиваем ваш сервер...' }}
                    </h1>
                    <p class="text-lg text-zinc-300 max-w-md mx-auto">
                        {{ deployReady ? 'OpenClaw развёрнут и готов к работе. Напишите боту!' : 'Оплата прошла успешно. Развёртывание занимает 3-5 минут.' }}
                    </p>

                    <!-- Deploy Progress Steps -->
                    <div class="max-w-sm mx-auto w-full flex flex-col gap-0 mt-2">
                        <!-- Step 1: Payment -->
                        <div class="flex items-center gap-3 py-3">
                            <div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            <span class="text-sm text-emerald-400 font-medium">Оплата прошла</span>
                        </div>

                        <!-- Connector -->
                        <div class="ml-[15px] w-px h-4" :class="deployStatus.assigned ? 'bg-emerald-500/40' : 'bg-zinc-700'"></div>

                        <!-- Step 2: Server assigned -->
                        <div class="flex items-center gap-3 py-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="deployStatus.assigned ? 'bg-emerald-500/20' : 'bg-zinc-800'">
                                <svg v-if="deployStatus.assigned" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                                <div v-else class="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></div>
                            </div>
                            <span class="text-sm font-medium" :class="deployStatus.assigned ? 'text-emerald-400' : 'text-zinc-400'">
                                {{ deployStatus.assigned ? 'Сервер назначен' : 'Назначаем сервер...' }}
                            </span>
                        </div>

                        <!-- Connector -->
                        <div class="ml-[15px] w-px h-4" :class="deployReady ? 'bg-emerald-500/40' : 'bg-zinc-700'"></div>

                        <!-- Step 3: OpenClaw ready -->
                        <div class="flex items-center gap-3 py-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="deployReady ? 'bg-emerald-500/20' : 'bg-zinc-800'">
                                <svg v-if="deployReady" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                                <div v-else-if="deployStatus.assigned" class="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></div>
                                <div v-else class="w-3 h-3 rounded-full bg-zinc-600"></div>
                            </div>
                            <span class="text-sm font-medium" :class="deployReady ? 'text-emerald-400' : deployStatus.assigned ? 'text-zinc-400' : 'text-zinc-600'">
                                {{ deployReady ? 'OpenClaw настроен' : deployStatus.assigned ? 'Настраиваем OpenClaw...' : 'Настройка OpenClaw' }}
                            </span>
                        </div>
                    </div>

                    <!-- Ready message -->
                    <div v-if="deployReady" class="flex flex-col gap-3 items-center mt-2">
                        <p class="text-base text-emerald-400 font-medium">Напишите вашему боту в Telegram!</p>
                        <button @click="goToProfile" class="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-6 py-3 rounded-xl transition-colors mt-2">Открыть профиль</button>
                    </div>

                    <!-- Pairing info -->
                    <div v-if="deployReady" class="max-w-md mx-auto w-full mt-4 p-4 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-left">
                        <p class="text-sm text-zinc-300 leading-relaxed">
                            Если бот прислал вам сообщение вида:
                        </p>
                        <div class="mt-2 p-3 bg-zinc-800/80 rounded-lg font-mono text-xs text-zinc-400 leading-relaxed">
                            OpenClaw: access not configured.<br>
                            Your Telegram user id: &lt;Ваш телеграм id&gt;<br>
                            Pairing code: XXXXXXXX
                        </div>
                        <p class="mt-2 text-sm text-zinc-300 leading-relaxed">
                            Не пугайтесь, это не ошибка — происходит запоминание вашего аккаунта. Это сделано в целях безопасности. Просто подождите пару минут и попробуйте снова.
                        </p>
                    </div>

                    <!-- Error state -->
                    <div v-if="deployStatus.status === 'error'" class="mt-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl max-w-sm mx-auto">
                        <p class="text-sm text-red-400">Произошла ошибка при настройке. Обратитесь в поддержку.</p>
                    </div>
                </div>
            </template>

            <!-- PROFILE PAGE -->
            <template v-else-if="showProfilePage">
                <div class="w-full px-4 sm:px-6 md:px-8 pt-16 sm:pt-24 pb-10 flex flex-col gap-6 max-w-2xl mx-auto min-w-0">
                    <div class="flex items-center justify-between">
                        <h1 class="text-2xl sm:text-3xl font-bold text-white">Профиль</h1>
                        <button @click="closeProfile" class="text-zinc-400 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div class="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
                        <div class="flex items-center gap-4">
                            <div class="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                                <svg width="32" height="32" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.5625 17C17.269 17 17.7906 16.303 17.5242 15.662C16.288 12.698 13.3838 11 10 11C6.61691 11 3.71295 12.698 2.47658 15.662C2.21015 16.303 2.73178 17 3.43817 17H16.5625ZM6.08334 5C6.08334 2.794 7.91567 1 10 1C12.0843 1 13.9167 2.794 13.9167 5C13.9167 7.206 12.0843 9 10 9C7.91567 9 6.08334 7.206 6.08334 5Z" fill="#71717a"/>
                                </svg>
                            </div>
                            <div>
                                <p class="text-lg font-medium text-white">{{ user.email }}</p>
                                <p class="text-sm text-zinc-500">{{ profile.selected_model || 'claude-sonnet-4' }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Deploy Progress (shown when server not ready) -->
                    <div v-if="subscription && subscription.is_active && !deployReady" class="bg-zinc-900/50 border border-blue-500/20 rounded-2xl p-6 flex flex-col gap-4">
                        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 animate-spin" style="animation-duration: 2s;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            Настройка сервера
                        </h2>
                        <div class="flex flex-col gap-0">
                            <div class="flex items-center gap-3 py-2">
                                <div class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                                </div>
                                <span class="text-sm text-emerald-400">Оплата прошла</span>
                            </div>
                            <div class="ml-[11px] w-px h-3" :class="deployStatus.assigned ? 'bg-emerald-500/40' : 'bg-zinc-700'"></div>
                            <div class="flex items-center gap-3 py-2">
                                <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" :class="deployStatus.assigned ? 'bg-emerald-500/20' : 'bg-zinc-800'">
                                    <svg v-if="deployStatus.assigned" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                                    <div v-else class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                                </div>
                                <span class="text-sm" :class="deployStatus.assigned ? 'text-emerald-400' : 'text-zinc-400'">{{ deployStatus.assigned ? 'Сервер назначен' : 'Назначаем сервер...' }}</span>
                            </div>
                            <div class="ml-[11px] w-px h-3" :class="deployStatus.openclaw_running ? 'bg-emerald-500/40' : 'bg-zinc-700'"></div>
                            <div class="flex items-center gap-3 py-2">
                                <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" :class="deployStatus.openclaw_running ? 'bg-emerald-500/20' : 'bg-zinc-800'">
                                    <svg v-if="deployStatus.openclaw_running" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                                    <div v-else-if="deployStatus.assigned" class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                                    <div v-else class="w-2 h-2 rounded-full bg-zinc-600"></div>
                                </div>
                                <span class="text-sm" :class="deployStatus.openclaw_running ? 'text-emerald-400' : deployStatus.assigned ? 'text-zinc-400' : 'text-zinc-600'">{{ deployStatus.openclaw_running ? 'OpenClaw настроен' : deployStatus.assigned ? 'Настраиваем OpenClaw...' : 'Настройка OpenClaw' }}</span>
                            </div>
                        </div>
                        <div v-if="deployStatus.status === 'error'" class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <p class="text-sm text-red-400">Произошла ошибка. Обратитесь в поддержку.</p>
                        </div>
                    </div>

                    <div class="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
                        <h2 class="text-lg font-semibold text-white">Подписка</h2>
                        <div v-if="subscription && subscription.is_active" class="flex flex-col gap-3">
                            <div class="flex justify-between items-center">
                                <span class="text-zinc-400">Статус</span>
                                <span class="text-emerald-400 font-medium">Активна</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-zinc-400">Действует до</span>
                                <span class="text-white">{{ formatDate(subscription.current_period_end) }}</span>
                            </div>

                            <!-- Token Usage Progress Bar -->
                            <div class="mt-4 pt-4 border-t border-zinc-700/50">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-zinc-400 text-sm">Использовано</span>
                                    <span class="text-white text-sm font-medium">{{ usage.used.toFixed(4) }} / {{ usage.limit }} $</span>
                                </div>
                                <div class="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        class="h-full rounded-full transition-all duration-500"
                                        :class="usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'"
                                        :style="{ width: Math.min(usagePercent, 100) + '%' }"
                                    ></div>
                                </div>
                            </div>

                            <!-- If cancellation scheduled, show status instead of button -->
                            <div v-if="subscription.cancellation_scheduled" class="mt-4 w-full py-3 px-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <p class="text-amber-400 text-sm text-center">Подписка заканчивается {{ formatDate(subscription.current_period_end) }}</p>
                            </div>
                            <button v-else @click="cancelSubscription" class="mt-4 w-full py-3 px-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors">
                                Отменить подписку
                            </button>
                        </div>
                        <div v-else class="text-zinc-500">
                            Нет активной подписки
                        </div>
                    </div>

                    <!-- Pairing info (shown when bot is active) -->
                    <div v-if="subscription && subscription.is_active && deployReady" class="bg-zinc-900/50 border border-zinc-700/50 rounded-2xl p-5 flex flex-col gap-2">
                        <p class="text-sm text-zinc-300 leading-relaxed">
                            Если бот прислал вам сообщение вида:
                        </p>
                        <div class="p-3 bg-zinc-800/80 rounded-lg font-mono text-xs text-zinc-400 leading-relaxed">
                            OpenClaw: access not configured.<br>
                            Your Telegram user id: &lt;Ваш телеграм id&gt;<br>
                            Pairing code: XXXXXXXX
                        </div>
                        <p class="text-sm text-zinc-300 leading-relaxed">
                            Не пугайтесь, это не ошибка — происходит запоминание вашего аккаунта. Это сделано в целях безопасности. Просто подождите пару минут и попробуйте снова.
                        </p>
                    </div>

                    <button @click="closeProfile" class="w-full py-3 px-4 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors">
                        Назад
                    </button>
                </div>
            </template>

            <!-- LANDING (shown for all non-success states) -->
            <!-- For subscribed users, show success block instead of model selection -->
            <template v-else-if="isAuthenticated && subscription && subscription.is_active">
                <div class="w-full px-4 sm:px-6 md:px-8 pt-16 sm:pt-24 pb-10 flex flex-col gap-6 text-center min-w-0">
                    <div class="flex justify-center">
                        <div class="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400">
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                        </div>
                    </div>
                    <h1 class="text-3xl sm:text-4xl font-bold text-white">Ваш OpenClaw активен!</h1>
                    <p class="text-lg text-zinc-300 max-w-md mx-auto">
                        Напишите вашему боту и убедитесь, что всё готово!
                    </p>
                    <div class="flex justify-center mt-4">
                        <button @click="goToProfile" class="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-6 py-3 rounded-xl transition-colors">Открыть профиль</button>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class="w-full px-4 sm:px-6 md:px-8 pt-8 sm:pt-12 md:pt-24 pb-6 sm:pb-10 md:pb-12 flex flex-col gap-3 sm:gap-4 text-center min-w-0">
                    <h1 class="main-text text-balance">Разверните OpenClaw менее чем за 1 минуту</h1>
                    <p class="text-sm sm:text-base text-zinc-400 leading-relaxed text-pretty max-w-xl mx-auto">Избавьтесь от технической сложности и разверните собственный экземпляр OpenClaw, работающий 24/7, в один клик.</p>
                </div>

                <div class="w-full flex justify-center">
                    <div class="flex flex-col items-center w-full md:w-[80%]">
                        <div class="card-frame relative p-2 border border-white/8 rounded-[24px] w-full">
                            <div class="w-full min-w-[280px] min-h-[200px] overflow-hidden bg-[#07080A] border border-white/5 rounded-2xl">
                                <div class="w-full p-4 sm:p-6 md:p-8 flex flex-col gap-6 sm:gap-8 md:gap-10 min-w-0">

                                    <!-- Model Selection -->
                                    <div class="flex flex-col gap-3 sm:gap-4">
                                        <h1 class="font-medium text-base sm:text-lg text-balance">Какую модель вы хотите использовать по умолчанию?</h1>
                                        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                            <button v-for="model in models" :key="model.id" type="button" class="options-card transition-all duration-300 rounded-xl py-3 px-4 flex flex-row items-center gap-2 hover:cursor-pointer group model-btn" :class="{ selected: selectedModel === model.id }" :data-tippy-content="model.tooltip" @click="selectedModel = model.id">
                                                <img :src="model.icon" :alt="model.name" class="w-5 h-5 shrink-0" />
                                                <h2 class="font-medium text-sm min-w-0 flex-1 text-left" :class="selectedModel === model.id ? 'text-white' : 'text-zinc-400 group-hover:text-white'">{{ model.name }}</h2>
                                                <span v-if="selectedModel === model.id" class="shrink-0 ml-auto"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 text-zinc-400"><path d="M5 12l5 5l10 -10" /></svg></span>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Channel Selection -->
                                    <div class="flex flex-col gap-3 sm:gap-4">
                                        <h1 class="font-medium text-base sm:text-lg text-balance">Какой канал вы хотите использовать для отправки сообщений?</h1>
                                        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-wrap">
                                            <button v-for="channel in channels" :key="channel.id" type="button" class="options-card transition-all duration-300 rounded-xl py-3 flex flex-row items-center gap-2 hover:cursor-pointer group relative px-4 sm:px-7" :class="{ selected: selectedChannel === channel.id }" :disabled="channel.disabled" @click="selectChannel(channel)">
                                                <img :src="channel.icon" :alt="channel.name" class="w-5 h-5 shrink-0 object-contain" />
                                                <h2 class="font-medium text-sm min-w-0 flex-1 text-left" :class="selectedChannel === channel.id ? 'text-white' : 'text-zinc-400 group-hover:text-white'">{{ channel.name }}</h2>
                                                <span v-if="selectedChannel === channel.id" class="shrink-0 ml-auto"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 text-zinc-400"><path d="M5 12l5 5l10 -10" /></svg></span>
                                                <span v-if="channel.disabled" class="absolute bottom-0 right-0 text-[10px] text-zinc-400 pr-2 pb-1">Скоро</span>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Telegram Instructions Panel (hidden - using modal instead) -->
                                    <div v-if="false" class="flex flex-col md:flex-row gap-6 mt-2">
                                        <div class="flex-1 flex flex-col gap-4">
                                            <div class="flex items-center gap-3">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png" class="w-8 h-8" />
                                                <h2 class="text-lg font-semibold text-white">Подключить Telegram</h2>
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <h3 class="text-sm font-medium text-zinc-300">Как получить токен бота?</h3>
                                                <ol class="list-decimal list-inside text-sm text-zinc-400 space-y-1 pl-1">
                                                    <li>Откройте Telegram и перейдите к <a href="https://t.me/BotFather" target="_blank" class="text-blue-400 hover:underline">@BotFather</a>.</li>
                                                    <li>Начните чат и введите <code class="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">/newbot</code>.</li>
                                                    <li>Следуйте инструкциям, чтобы назвать бота и выбрать username.</li>
                                                    <li>BotFather отправит вам токен. Скопируйте его полностью.</li>
                                                    <li>Вставьте токен в поле ниже и нажмите «Сохранить».</li>
                                                </ol>
                                            </div>
                                            <div class="flex flex-col gap-2">
                                                <label class="text-sm text-zinc-400">Введите токен бота</label>
                                                <input v-model="pendingTelegramToken" type="text" placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz" :class="['bg-zinc-800/50 border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none w-full transition-colors', telegramTokenError ? 'border-red-500 focus:border-red-400' : 'border-zinc-700 focus:border-zinc-500']" />
                                                <p v-if="telegramTokenError" class="text-sm text-red-400">{{ telegramTokenError }}</p>
                                            </div>
                                            <button type="button" @click="saveTelegramAndLogin" :disabled="loading || !isValidTelegramToken" class="bg-zinc-700 hover:bg-zinc-600 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-fit">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10" /></svg>
                                                {{ loading ? 'Сохранение...' : 'Сохранить и подключить' }}
                                            </button>
                                        </div>
                                        <div class="hidden md:flex items-center justify-center">
                                            <div class="relative w-[220px] h-[440px] rounded-[36px] overflow-hidden border-4 border-zinc-800 bg-black shadow-2xl">
                                                <video autoplay loop muted playsinline class="w-full h-full object-cover">
                                                    <source src="/demo.mp4" type="video/mp4" />
                                                </video>
                                            </div>
                                        </div>
                                    </div>


                                    <!-- Login Button / Authenticated Message -->
                                    <div class="w-full flex flex-col gap-3 min-w-0">
                                        <template v-if="!isAuthenticated">
                                            <button type="button" @click="loginWithGoogle" :disabled="loading || availableServers === 0" class="bg-white text-black font-medium text-sm sm:text-base px-4 sm:px-5 py-2.5 w-full sm:w-fit rounded-xl cursor-pointer flex flex-row items-center justify-center gap-2 main-btn-shadow transition-all duration-300 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/500px-Google_%22G%22_logo.svg.png" alt="" class="size-5" />
                                                <span class="text-base font-medium">{{ loading ? 'Вход...' : 'Войти через Google' }}</span>
                                            </button>
                                            <p v-if="authError" class="text-sm text-red-400">{{ authError }}</p>
                                            <p class="text-[#6A6B6C] text-sm" v-if="availableServers > 0">Войдите, чтобы развернуть AI-ассистента и подключить каналы. <span class="text-indigo-400 font-medium">Серверов ограничено — осталось {{ availableServers }}</span></p>
                                            <p class="text-red-400 text-sm font-medium" v-else>К сожалению, все серверы заняты. Попробуйте повторно через 5 минут.</p>
                                        </template>
                                        <template v-else>
                                            <div class="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 shrink-0"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></svg>
                                                <p class="text-sm text-zinc-300">Нажмите на кнопку <span class="text-blue-400 font-medium">Telegram</span> и введите токен бота</p>
                                            </div>
                                        </template>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Comparison section -->
                <section class="w-full px-4 sm:px-6 py-12 sm:py-20 md:py-32 flex flex-col gap-3 max-w-5xl mx-auto min-w-0">
                    <div class="w-full flex flex-wrap items-center justify-center gap-2 sm:gap-4 px-2">
                        <div class="flex-1 max-w-[180px] h-0.5 bg-gradient-to-l from-[#581D27] to-transparent"></div>
                        <span class="text-xs sm:text-sm text-zinc-400">Сравнение</span>
                        <div class="flex-1 max-w-[180px] h-0.5 bg-gradient-to-r from-[#581D27] to-transparent"></div>
                    </div>
                    <h1 class="main-text mb-6 sm:mb-10 text-balance">Традиционный метод vs SimpleClaw</h1>
                    <div class="flex flex-col md:flex-row items-stretch min-w-0 mt-4">
                        <div class="flex-1 md:pr-10 min-w-0 flex flex-col gap-2 pb-6 md:pb-0">
                            <p class="text-base sm:text-lg font-medium text-zinc-400 italic mb-1">Традиционный</p>
                            <ul class="flex flex-col gap-2 sm:gap-3">
                                <li v-for="step in traditionalSteps" :key="step.label" class="flex justify-between gap-2 text-sm sm:text-base text-zinc-400">
                                    <span>{{ step.label }}</span><span class="tabular-nums">{{ step.time }} мин</span>
                                </li>
                            </ul>
                            <p class="mt-3 pt-3 border-t-2 border-white/20 flex justify-between text-base sm:text-lg font-medium text-white"><span class="italic">Итого</span><span class="tabular-nums">3 часа</span></p>
                        </div>
                        <div class="w-full md:w-[2px] h-[2px] md:h-auto shrink-0 bg-white/10"></div>
                        <div class="flex-1 md:pl-10 min-w-0 flex flex-col justify-center pt-6 md:pt-0 gap-3">
                            <p class="text-base sm:text-lg font-medium text-zinc-400 italic">SimpleClaw</p>
                            <p class="text-2xl sm:text-3xl font-semibold text-white tabular-nums">&lt;1 мин</p>
                            
                            <p class="text-sm sm:text-base text-zinc-400">Выберите модель, подключите Telegram, разверните — готово.</p>
                            <p class="text-sm text-emerald-400/80">$15 API-кредитов включено ежемесячно</p>
                        </div>
                    </div>
                </section>

                <!-- Use cases -->
                <section class="w-full px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-8 sm:gap-12 max-w-5xl mx-auto min-w-0">
                    <div class="flex flex-col items-center justify-center gap-1 sm:gap-2">
                        <h2 class="text-2xl sm:text-3xl md:text-4xl font-medium text-white text-center text-balance">Что OpenClaw может сделать для вас?</h2>
                        <h2 class="text-2xl sm:text-3xl md:text-4xl font-medium text-[#6A6B6C] text-center text-balance">Один ассистент, тысячи сценариев</h2>
                    </div>
                    <div class="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl gap-2 min-w-0">
                        <div v-for="(row, idx) in marqueeRows" :key="idx" class="marquee-wrapper flex overflow-hidden p-2 flex-row" :style="{ '--duration': (38 + idx * 2) + 's', '--gap': '0.5rem' }">
                            <div class="flex shrink-0 justify-around animate-marquee flex-row" :style="{ gap: 'var(--gap)', animationDirection: idx % 2 === 1 ? 'reverse' : 'normal' }">
                                <span v-for="item in row" :key="item" class="inline-flex items-center gap-2 options-card rounded-xl px-4 py-2.5 border border-white/10 text-sm font-medium text-zinc-300 shrink-0">{{ item }}</span>
                            </div>
                            <div class="flex shrink-0 justify-around animate-marquee flex-row" aria-hidden="true" :style="{ gap: 'var(--gap)', animationDirection: idx % 2 === 1 ? 'reverse' : 'normal' }">
                                <span v-for="item in row" :key="item + '-dup'" class="inline-flex items-center gap-2 options-card rounded-xl px-4 py-2.5 border border-white/10 text-sm font-medium text-zinc-300 shrink-0">{{ item }}</span>
                            </div>
                        </div>
                        <div class="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-12 md:w-20 bg-linear-to-r from-zinc-950 to-transparent z-10"></div>
                        <div class="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-12 md:w-20 bg-linear-to-l from-zinc-950 to-transparent z-10"></div>
                    </div>
                </section>
            </template>

            <!-- Footer -->
            <div class="w-full px-4 sm:px-6 pt-12 pb-8 flex flex-col gap-6 max-w-5xl mx-auto items-center text-center">
                <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
                    <a href="/articles/how-to-install-openclaw.html" class="text-zinc-400 hover:text-white transition-colors">Как установить</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/what-is-openclaw.html" class="text-zinc-400 hover:text-white transition-colors">Что такое OpenClaw</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/top-5-ways-to-use-openclaw.html" class="text-zinc-400 hover:text-white transition-colors">Топ 5 способов</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-security-guide.html" class="text-zinc-400 hover:text-white transition-colors">Безопасность</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-token-optimization.html" class="text-zinc-400 hover:text-white transition-colors">Оптимизация токенов</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-vs-chatgpt.html" class="text-zinc-400 hover:text-white transition-colors">OpenClaw vs ChatGPT</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-telegram-setup.html" class="text-zinc-400 hover:text-white transition-colors">Telegram-бот</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-browser-automation.html" class="text-zinc-400 hover:text-white transition-colors">Автоматизация</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-for-business.html" class="text-zinc-400 hover:text-white transition-colors">Для бизнеса</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-models-comparison.html" class="text-zinc-400 hover:text-white transition-colors">Сравнение моделей</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-privacy-selfhosted.html" class="text-zinc-400 hover:text-white transition-colors">Приватность</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-skills-plugins.html" class="text-zinc-400 hover:text-white transition-colors">Скиллы и плагины</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/articles/openclaw-email-calendar.html" class="text-zinc-400 hover:text-white transition-colors">Почта и календарь</a>
                </div>
                <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:text-base">
                    <span class="text-white font-medium">Тарасов Святослав</span>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="mailto:tarasov.slavas2@gmail.com" class="text-white hover:text-zinc-400 transition-colors">Связаться</a>
                    <div class="size-1 rounded-full bg-current opacity-60"></div>
                    <a href="/agreement.html" class="text-zinc-400 hover:text-white transition-colors text-sm">Соглашение</a>
                </div>
            </div>
        </div>
    </div>

    <!-- Telegram Instructions Modal -->
    <div v-if="showTelegramModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showTelegramModal = false">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative bg-[#0A0B0D] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-4xl w-full flex flex-col md:flex-row gap-6">
            <button @click="showTelegramModal = false" class="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors z-10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>

            <!-- Left side - Instructions -->
            <div class="flex-1 flex flex-col gap-4">
                <div class="flex items-center gap-3">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png" class="w-10 h-10" />
                    <h2 class="text-xl font-semibold text-white">Подключить Telegram</h2>
                </div>
                <div class="flex flex-col gap-3 text-sm text-zinc-300">
                    <p class="text-zinc-400">Как получить токен бота?</p>
                    <p><span class="text-white font-medium">1.</span> Откройте <a href="https://t.me/BotFather" target="_blank" class="text-blue-400 hover:underline">@BotFather</a> в Telegram</p>
                    <p><span class="text-white font-medium">2.</span> Отправьте команду <code class="bg-zinc-800 px-1.5 py-0.5 rounded">/newbot</code></p>
                    <p><span class="text-white font-medium">3.</span> Придумайте имя и username для бота</p>
                    <p><span class="text-white font-medium">4.</span> Скопируйте полученный токен</p>
                    <p><span class="text-white font-medium">5.</span> Вставьте токен ниже и нажмите «Сохранить»</p>
                </div>
                <div class="flex flex-col gap-2 mt-2">
                    <label class="text-zinc-400 text-sm">Токен бота</label>
                    <input
                        v-model="pendingTelegramToken"
                        type="text"
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        :class="['w-full bg-zinc-800 border rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none transition-colors text-sm', telegramTokenError ? 'border-red-500 focus:border-red-400' : 'border-zinc-700 focus:border-blue-500']"
                    />
                    <p v-if="telegramTokenError" class="text-sm text-red-400">{{ telegramTokenError }}</p>
                </div>
                <button @click="saveTelegramAndLogin" :disabled="loading || !isValidTelegramToken" class="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors w-full sm:w-fit disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>
                    {{ loading ? 'Загрузка...' : 'Сохранить и подключить' }}
                </button>
            </div>

            <!-- Mobile Video demo (below instructions) -->
            <div class="flex md:hidden items-center justify-center mt-4">
                <div class="relative w-[180px] h-[360px] rounded-[24px] overflow-hidden border-4 border-zinc-800 bg-black shadow-2xl">
                    <video autoplay loop muted playsinline class="w-full h-full object-cover">
                        <source src="/demo.mp4" type="video/mp4" />
                    </video>
                </div>
            </div>

            <!-- Desktop Video demo (right side) -->
            <div class="flex-1 hidden md:flex items-center justify-center">
                <div class="relative w-[240px] h-[480px] rounded-[32px] overflow-hidden border-4 border-zinc-800 bg-black shadow-2xl">
                    <video autoplay loop muted playsinline class="w-full h-full object-cover">
                        <source src="/demo.mp4" type="video/mp4" />
                    </video>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

const API_BASE = 'https://install-openclow.ru/api';
const GOOGLE_CLIENT_ID = '1568931022-iil9topt7v2n8p6m97crp4tc410800mf.apps.googleusercontent.com';

export default {
    name: 'App',
    data() {
        return {
            isAuthenticated: false,
            authToken: null,
            user: {},
            profile: {},
            subscription: null,
            server: null,
            usage: { used: 0, limit: 15, remaining: 15 },
            loading: false,
            authError: '',
            telegramError: '',
            telegramToken: '',
            pendingTelegramToken: '',
            selectedModel: 'claude-sonnet-4',
            selectedChannel: null,
            availableServers: 5,
            showTelegramModal: false,
            showSuccessPage: false,
            showProfileDropdown: false,
            showProfilePage: false,
            deployStatus: { assigned: false, openclaw_running: false, status: '' },
            deployPollTimer: null,
            models: [
                { id: "claude-sonnet-4", name: "Claude Sonnet 4", icon: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg", tooltip: "Лучший баланс цены и качества" },
                { id: "claude-opus-4.5", name: "Claude", icon: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg", tooltip: "Самая эффективная для сложных задач" },
                { id: "gemini-3-flash", name: "Gemini 3 Flash", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Google_Gemini_icon_2025.svg/960px-Google_Gemini_icon_2025.svg.png", tooltip: "Самая бюджетная и быстрая" },
            ],
            channels: [
                { id: 'telegram', name: 'Telegram', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png', disabled: false },
                { id: 'discord', name: 'Discord', icon: 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png', disabled: true },
                { id: 'whatsapp', name: 'WhatsApp', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/960px-WhatsApp.svg.png', disabled: true },
            ],
            traditionalSteps: [
                { label: 'Выбор и покупка сервера', time: 30 },
                { label: 'Создание SSH-ключей', time: 10 },
                { label: 'Подключение и настройка ОС', time: 20 },
                { label: 'Установка Docker и зависимостей', time: 30 },
                { label: 'Установка и сборка OpenClaw', time: 30 },
                { label: 'Настройка конфигурации', time: 30 },
                { label: 'Подключение Telegram и тесты', time: 30 },
            ],
            marqueeRows: [
                ['Чтение писем', 'Составление ответов', 'Перевод сообщений', 'Организация почты', 'Поддержка клиентов', 'Краткое изложение', 'Напоминания'],
                ['Планирование недели', 'Заметки на встречах', 'Учёт расходов', 'Управление подписками', 'Дедлайны', 'Синхронизация'],
                ['Поиск купонов', 'Сравнение цен', 'Анализ товаров', 'Расчёт зарплат', 'Возврат средств', 'Скидки'],
                ['Составление договоров', 'Исследование конкурентов', 'Создание счетов', 'Бронирование', 'Посты для соцсетей'],
            ],
        };
    },
    computed: {
        usagePercent() { return this.usage.limit > 0 ? (this.usage.used / this.usage.limit) * 100 : 0; },
        deployReady() { return this.deployStatus.assigned && this.deployStatus.openclaw_running; },
        isValidTelegramToken() {
            if (!this.pendingTelegramToken) return false;
            const tokenRegex = /^\d{6,15}:[A-Za-z0-9_-]{30,50}$/;
            return tokenRegex.test(this.pendingTelegramToken);
        },
        telegramTokenError() {
            if (!this.pendingTelegramToken) return '';
            if (!this.isValidTelegramToken) {
                return 'Неверный формат токена. Токен должен быть в формате: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
            }
            return '';
        }
    },
    mounted() {
        this.fetchAvailableServers();
        this.checkAuth();
        this.checkPaymentReturn();
        this.initGoogleAuth();
        this.$nextTick(() => {
            tippy('.model-btn', {
                placement: 'top',
                arrow: true,
                theme: 'dark',
            });
        });
    },
    beforeUnmount() {
        this.stopDeployPolling();
    },
    methods: {
        async apiCall(endpoint, options = {}) {
            const headers = { 'Content-Type': 'application/json' };
            if (this.authToken) headers['Authorization'] = 'Token ' + this.authToken;
            const resp = await fetch(API_BASE + endpoint, { ...options, headers });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || err.detail || 'Ошибка');
            }
            return resp.json();
        },
        selectChannel(channel) {
            if (channel.id === "telegram") {
                this.selectedChannel = 'telegram';
                this.showTelegramModal = true;
                return;
            }
            if (channel.disabled) return;
            this.selectedChannel = channel.id;
        },
        checkAuth() {
            const token = localStorage.getItem('authToken');
            if (token) {
                this.authToken = token;
                this.loadProfile();
            }
        },
        checkPaymentReturn() {
            const params = new URLSearchParams(window.location.search);
            if (params.get('payment') === 'success') {
                window.history.replaceState({}, '', window.location.pathname);
                this.showSuccessPage = true;
                this.startDeployPolling();
                // Validate pending telegram token if exists
                const pendingToken = localStorage.getItem('pendingTelegramToken');
                if (pendingToken) {
                    this.validatePendingTelegram(pendingToken);
                }
            }
        },
        startDeployPolling() {
            this.checkDeployStatus();
            this.deployPollTimer = setInterval(() => {
                this.checkDeployStatus();
            }, 5000);
        },
        stopDeployPolling() {
            if (this.deployPollTimer) {
                clearInterval(this.deployPollTimer);
                this.deployPollTimer = null;
            }
        },
        async checkDeployStatus() {
            if (!this.authToken) return;
            try {
                const data = await this.apiCall('/server/status/');
                this.deployStatus = {
                    assigned: data.assigned || false,
                    openclaw_running: data.openclaw_running || false,
                    status: data.status || '',
                };
                // Stop polling once fully deployed
                if (data.assigned && data.openclaw_running) {
                    this.stopDeployPolling();
                }
                // Stop polling on error (but keep showing progress)
                if (data.status === 'error') {
                    this.stopDeployPolling();
                }
            } catch (e) {
                // Auth might not be ready yet, keep polling
                console.log('Deploy status check:', e.message);
            }
        },
        async validatePendingTelegram(token) {
            try {
                await this.apiCall('/telegram/validate/', { method: 'POST', body: JSON.stringify({ token: token }) });
                localStorage.removeItem('pendingTelegramToken');
            } catch (e) {
                console.error('Failed to validate telegram token:', e);
            }
        },
        initGoogleAuth() {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = () => {
                if (window.google) {
                    window.google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        callback: this.handleGoogleCallback,
                        auto_select: false,
                    });
                }
            };
            document.head.appendChild(script);
        },
        handleGoogleCallback(response) {
            if (response.credential) this.authenticateWithGoogle(response.credential);
        },
        saveTelegramAndLogin() {
            if (this.pendingTelegramToken) {
                localStorage.setItem('pendingTelegramToken', this.pendingTelegramToken);
            }
            this.showTelegramModal = false;
            this.loginWithGoogle();
        },
        loginWithGoogle() {
            this.authError = '';
            if (window.google) {
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        window.google.accounts.oauth2.initTokenClient({
                            client_id: GOOGLE_CLIENT_ID,
                            scope: 'email profile',
                            callback: (tokenResponse) => {
                                if (tokenResponse.access_token) this.fetchGoogleUserInfo(tokenResponse.access_token);
                            },
                        }).requestAccessToken();
                    }
                });
            }
        },
        async fetchGoogleUserInfo(accessToken) {
            this.loading = true;
            try {
                const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
                const userInfo = await resp.json();
                await this.authenticateWithBackend(userInfo);
            } catch (e) { this.authError = 'Ошибка получения данных Google'; }
            finally { this.loading = false; }
        },
        async authenticateWithGoogle(credential) {
            this.loading = true;
            try {
                const data = await this.apiCall('/auth/google/', { method: 'POST', body: JSON.stringify({ token: credential }) });
                this.authToken = data.token;
                localStorage.setItem('authToken', data.token);
                this.user = data.user;
                await this.afterAuthFlow();
            } catch (e) { this.authError = e.message; }
            finally { this.loading = false; }
        },
        async authenticateWithBackend(userInfo) {
            this.loading = true;
            try {
                const data = await this.apiCall('/auth/google/', { method: 'POST', body: JSON.stringify({ email: userInfo.email, name: userInfo.name, google_id: userInfo.id, avatar_url: userInfo.picture }) });
                this.authToken = data.token;
                localStorage.setItem('authToken', data.token);
                this.user = data.user;
                await this.afterAuthFlow();
            } catch (e) { this.authError = e.message; }
            finally { this.loading = false; }
        },
        async afterAuthFlow() {
            await this.loadProfile();
            if (this.subscription && this.subscription.is_active) {
                this.showProfilePage = true;
                this.loadUsage();
                return;
            }
            await this.createPayment();
        },
        async loadProfile() {
            try {
                const data = await this.apiCall('/profile/');
                this.user = { email: data.email, avatar_url: data.profile?.avatar_url };
                this.profile = data.profile || {};
                this.server = data.server;
                this.selectedModel = this.profile.selected_model || 'claude-sonnet-4';
                this.isAuthenticated = true;

                if (data.subscription) {
                    this.subscription = data.subscription;
                } else if (data.profile?.subscription_status === 'active' || data.profile?.subscription_status === 'cancelling') {
                    this.subscription = {
                        is_active: true,
                        current_period_end: data.profile.subscription_expires_at,
                        auto_renew: data.profile.auto_renew,
                        cancellation_scheduled: data.profile.cancellation_scheduled || false,
                        cancelled_at: data.profile.cancelled_at
                    };
                } else {
                    this.subscription = null;
                }

                if (this.subscription && this.subscription.is_active) {
                    this.showProfilePage = true;
                    this.loadUsage();
                    // Check deploy status and start polling if not ready
                    this.checkDeployStatus().then(() => {
                        if (!this.deployReady && !this.deployPollTimer) {
                            this.startDeployPolling();
                        }
                    });
                }
            } catch (e) { this.logout(); }
        },
        logout() {
            this.stopDeployPolling();
            this.authToken = null;
            this.isAuthenticated = false;
            this.user = {};
            this.profile = {};
            this.subscription = null;
            this.server = null;
            this.showSuccessPage = false;
            this.showProfileDropdown = false;
            this.showProfilePage = false;
            localStorage.removeItem('authToken');
        },
        goToProfile() {
            this.stopDeployPolling();
            this.showProfileDropdown = false;
            this.showSuccessPage = false;
            this.showProfilePage = true;
            if (this.subscription && this.subscription.is_active) {
                this.loadUsage();
                // Start polling if server not ready yet
                if (!this.deployReady) {
                    this.startDeployPolling();
                }
            }
        },
        async loadUsage() {
            try {
                const data = await this.apiCall('/profile/usage/');
                this.usage = {
                    used: data.used || 0,
                    limit: data.limit || 15,
                    remaining: data.remaining || 15
                };
            } catch (e) {
                console.error('Failed to load usage:', e);
            }
        },
        closeProfile() {
            this.showProfilePage = false;
        },
        handleOutsideClick(e) {
            if (!e.target.closest('.relative') && this.showProfileDropdown) {
                this.showProfileDropdown = false;
            }
        },
        async cancelSubscription() {
            if (!confirm('Вы уверены, что хотите отменить подписку?')) return;
            try {
                await this.apiCall('/subscription/cancel/', { method: 'POST' });
                alert('Подписка отменена. Она будет активна до конца оплаченного периода.');
                await this.loadProfile();
            } catch (e) {
                alert('Ошибка: ' + e.message);
            }
        },
        goHome() { window.location.reload(); },
        async createPayment() {
            this.loading = true;
            try {
                const payload = {
                    telegram_token: this.pendingTelegramToken || localStorage.getItem('pendingTelegramToken'),
                    selected_model: this.selectedModel
                };
                const data = await this.apiCall('/payments/create/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (data.confirmation_url) window.location.href = data.confirmation_url;
            } catch (e) { alert('Ошибка: ' + e.message); }
            finally { this.loading = false; }
        },
        formatDate(d) { return d ? new Date(d).toLocaleDateString('ru-RU') : ''; },
        async fetchAvailableServers() {
            try {
                const res = await fetch(API_BASE + '/server/pool/');
                if (res.ok) {
                    const data = await res.json();
                    this.availableServers = data.available !== undefined ? data.available : 5;
                }
            } catch (e) { console.log('Could not fetch server pool'); }
        },
    },
};
</script>

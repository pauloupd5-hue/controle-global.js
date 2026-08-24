(function () {
    "use strict";

    // =========================================================
    // CONFIGURAÇÃO
    // =========================================================
    const CONFIG = {
        SHEET_ID: "1f7deYaMpiG9BSBv89Kd2Bus7mFawv6coudltgSqQZx4",
        GID: "0",
        // 30 segundos
        INTERVALO: 30000,
        // Se o Google ficar temporariamente indisponível,
        // mantém o último estado conhecido.
        MANTER_ULTIMO_ESTADO_EM_ERRO: true,
        // Só pra confirmar no console qual versão do arquivo está
        // realmente rodando (ajuda a diagnosticar cache do jsDelivr).
        VERSAO: "2.1-com-interceptacao-debug"
    };

    console.log(
        "%c[CONTROLE GLOBAL] Versão carregada: " + CONFIG.VERSAO,
        "color: #00bcd4; font-weight: bold; font-size: 13px; background:#000; padding:2px 6px; border-radius:3px;"
    );

    // =========================================================
    // ESTADO
    // =========================================================
    // Começa bloqueado.
    let ativo = false;
    // Só libera depois da primeira confirmação.
    let estadoConfirmado = false;
    let verificando = false;

    const ESTADO_PERSISTIDO_KEY = "__CONTROLE_GLOBAL_ULTIMO_ESTADO__";

    function salvarUltimoEstadoConfirmado(valorAtivo) {
        try {
            if (typeof GM_setValue === "function") {
                GM_setValue(ESTADO_PERSISTIDO_KEY, valorAtivo ? "ativo" : "inativo");
            } else {
                sessionStorage.setItem(ESTADO_PERSISTIDO_KEY, valorAtivo ? "ativo" : "inativo");
            }
        } catch (e) {}
    }

    function carregarUltimoEstadoConfirmado() {
        try {
            if (typeof GM_getValue === "function") {
                return GM_getValue(ESTADO_PERSISTIDO_KEY, null);
            }
            return sessionStorage.getItem(ESTADO_PERSISTIDO_KEY);
        } catch (e) {
            return null;
        }
    }

    // =========================================================
    // AVISO
    // =========================================================
    const AVISO_KEY = "__CONTROLE_GLOBAL_TAMPERMONKEY__";

    // =========================================================
    // URL DA PLANILHA
    // =========================================================
    function criarURL() {
        return (
            "https://docs.google.com/spreadsheets/d/" +
            CONFIG.SHEET_ID +
            "/gviz/tq?tqx=out:json&gid=" +
            CONFIG.GID +
            "&t=" +
            Date.now()
        );
    }

    // =========================================================
    // VERIFICAR CONTROLE
    // =========================================================
    function verificar() {
        if (verificando) return;
        verificando = true;

        console.log("[CONTROLE GLOBAL] Verificando B1...");

        GM_xmlhttpRequest({
            method: "GET",
            url: criarURL(),
            timeout: 10000,
            onload: function (resposta) {
                try {
                    if (resposta.status < 200 || resposta.status >= 300) {
                        throw new Error("HTTP " + resposta.status);
                    }

                    const texto = resposta.responseText;
                    const inicio = texto.indexOf("{");
                    const fim = texto.lastIndexOf("}");

                    if (inicio === -1 || fim === -1) {
                        throw new Error("Resposta do Google inválida.");
                    }

                    const dados = JSON.parse(texto.substring(inicio, fim + 1));
                    const linha = dados?.table?.rows?.[0];

                    if (!linha) {
                        throw new Error("Não foi possível encontrar B1.");
                    }

                    const valorB1 = linha.c?.[1]?.v ?? "";
                    const status = String(valorB1).trim().toLowerCase();

                    if (status === "ativo") {
                        ativo = true;
                        estadoConfirmado = true;
                        salvarUltimoEstadoConfirmado(true);
                        removerAviso();
                        console.log("%c[CONTROLE GLOBAL] 🟢 ATIVO", "color: green; font-weight: bold;");
                    } else {
                        ativo = false;
                        estadoConfirmado = true;
                        salvarUltimoEstadoConfirmado(false);
                        mostrarAviso();
                        console.warn("[CONTROLE GLOBAL] 🔴 INATIVO");
                    }
                } catch (erro) {
                    tratarErro(erro);
                } finally {
                    verificando = false;
                }
            },
            onerror: function () {
                tratarErro(new Error("Falha de conexão com o Google."));
            },
            ontimeout: function () {
                tratarErro(new Error("Timeout ao consultar Google Sheets."));
            }
        });
    }

    // =========================================================
    // TRATAMENTO DE ERRO
    // =========================================================
    function tratarErro(erro) {
        console.warn("[CONTROLE GLOBAL] ⚠️ Erro:", erro);

        if (CONFIG.MANTER_ULTIMO_ESTADO_EM_ERRO) {
            // Se ainda não temos nenhum estado confirmado nesta sessão,
            // tenta recuperar o último estado confirmado persistido.
            if (!estadoConfirmado) {
                const persistido = carregarUltimoEstadoConfirmado();
                if (persistido === "ativo") {
                    ativo = true;
                    estadoConfirmado = true;
                    removerAviso();
                    console.log("[CONTROLE GLOBAL] Usando último estado persistido: ATIVO");
                } else if (persistido === "inativo") {
                    ativo = false;
                    estadoConfirmado = true;
                    mostrarAviso();
                    console.log("[CONTROLE GLOBAL] Usando último estado persistido: INATIVO");
                }
                // Se não há nada persistido, permanece bloqueado (fail-safe padrão).
            }
            // Se já havia um estado confirmado nesta sessão, mantém como está.
        } else {
            ativo = false;
            estadoConfirmado = true;
            mostrarAviso();
        }

        verificando = false;
    }

    // =========================================================
    // MOSTRAR AVISO
    // =========================================================
    function mostrarAviso() {
        if (sessionStorage.getItem(AVISO_KEY)) return;
        sessionStorage.setItem(AVISO_KEY, "1");
        alert(
            "Ops! Os DOM do site atualizaram e eu não consigo realizar as ações.\n\n" +
            "Desative este script no Tampermonkey para essa mensagem parar de aparecer."
        );
    }

    // =========================================================
    // REMOVER AVISO
    // =========================================================
    function removerAviso() {
        sessionStorage.removeItem(AVISO_KEY);
    }

    // =========================================================
    // VERIFICAR SE PODE EXECUTAR
    // =========================================================
    function podeExecutar() {
        return estadoConfirmado === true && ativo === true;
    }

    // =========================================================
    // INTERCEPTAÇÃO DOS MECANISMOS DE AUTOMAÇÃO
    // (isto é o que efetivamente bloqueia os scripts quando B1 = Inativo;
    //  faltava por completo na versão anterior)
    // =========================================================

    let contadorBloqueios = 0;

    function bloquearChamada(mecanismo) {
        contadorBloqueios++;
        console.warn(
            "%c[CONTROLE GLOBAL] 🚫 Chamada bloqueada #" + contadorBloqueios + " (" + mecanismo + ")",
            "color: #ff5252; font-weight: bold;"
        );
        mostrarAviso();
    }

    // --- setTimeout ---
    const _setTimeout = window.setTimeout.bind(window);
    window.setTimeout = function (fn, delay, ...args) {
        if (typeof fn !== "function") return _setTimeout(fn, delay, ...args);
        return _setTimeout(function () {
            if (!podeExecutar()) { bloquearChamada("setTimeout"); return; }
            fn(...args);
        }, delay);
    };

    // --- setInterval ---
    const _setInterval = window.setInterval.bind(window);
    window.setInterval = function (fn, delay, ...args) {
        if (typeof fn !== "function") return _setInterval(fn, delay, ...args);
        return _setInterval(function () {
            if (!podeExecutar()) { bloquearChamada("setInterval"); return; }
            fn(...args);
        }, delay);
    };

    // --- requestAnimationFrame ---
    if (typeof window.requestAnimationFrame === "function") {
        const _raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = function (fn) {
            return _raf(function (ts) {
                if (!podeExecutar()) { bloquearChamada("requestAnimationFrame"); return; }
                fn(ts);
            });
        };
    }

    // --- MutationObserver ---
    if (typeof window.MutationObserver === "function") {
        const _MutationObserver = window.MutationObserver;
        function ControleGlobalMutationObserver(callback) {
            return new _MutationObserver(function (mutations, observer) {
                if (!podeExecutar()) { bloquearChamada("MutationObserver"); return; }
                callback(mutations, observer);
            });
        }
        ControleGlobalMutationObserver.prototype = _MutationObserver.prototype;
        window.MutationObserver = ControleGlobalMutationObserver;
    }

    // --- fetch ---
    if (typeof window.fetch === "function") {
        const _fetch = window.fetch.bind(window);
        window.fetch = function (...args) {
            if (!podeExecutar()) {
                bloquearChamada("fetch");
                return Promise.reject(new Error("[CONTROLE GLOBAL] Bloqueado (script inativo)."));
            }
            return _fetch(...args);
        };
    }

    // --- XMLHttpRequest.send ---
    if (typeof XMLHttpRequest !== "undefined" && XMLHttpRequest.prototype.send) {
        const _send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
            if (!podeExecutar()) {
                bloquearChamada("XMLHttpRequest.send");
                return;
            }
            return _send.apply(this, args);
        };
    }

    // --- GM_xmlhttpRequest ---
    if (typeof GM_xmlhttpRequest === "function") {
        const _gmxhr = GM_xmlhttpRequest;
        window.GM_xmlhttpRequest = function (detalhes) {
            // Exceção: a própria checagem do Kill Switch usa GM_xmlhttpRequest
            // para ler a planilha, então deixamos passar chamadas para o
            // próprio Google Sheets de configuração, senão o controlador
            // nunca conseguiria se atualizar de novo.
            const url = detalhes && detalhes.url ? String(detalhes.url) : "";
            const ehChamadaDoProprioControlador = url.indexOf("docs.google.com/spreadsheets/d/" + CONFIG.SHEET_ID) !== -1;

            if (!ehChamadaDoProprioControlador && !podeExecutar()) {
                bloquearChamada("GM_xmlhttpRequest -> " + url);
                return;
            }
            return _gmxhr(detalhes);
        };
    }

    // =========================================================
    // API PÚBLICA
    // =========================================================
    window.ControleGlobal = {
        verificar,
        podeExecutar,
        get ativo() { return ativo; },
        get confirmado() { return estadoConfirmado; }
    };

    // =========================================================
    // PRIMEIRA VERIFICAÇÃO
    // =========================================================
    verificar();

    // =========================================================
    // VERIFICAÇÃO AUTOMÁTICA
    // (usa a função ORIGINAL, não a versão interceptada acima —
    //  senão, uma vez Inativo, o próprio controlador nunca mais
    //  conseguiria se checar de novo e recuperar o Ativo)
    // =========================================================
    _setInterval(verificar, CONFIG.INTERVALO);
})();

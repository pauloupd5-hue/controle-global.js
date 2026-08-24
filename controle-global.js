(function () {

    "use strict";


    // =========================================================
    // CONFIGURAÇÃO
    // =========================================================

    const CONFIG = {

        SHEET_ID:
            "1f7deYaMpiG9BSBv89Kd2Bus7mFawv6coudltgSqQZx4",

        GID: "0",

        // 30 segundos
        INTERVALO: 30000,

        // Se o Google ficar temporariamente indisponível,
        // mantém o último estado conhecido.
        MANTER_ULTIMO_ESTADO_EM_ERRO: true

    };


    // =========================================================
    // ESTADO
    // =========================================================

    // Começa bloqueado.
    let ativo = false;

    // Só libera depois da primeira confirmação.
    let estadoConfirmado = false;

    let verificando = false;


    // =========================================================
    // AVISO
    // =========================================================

    const AVISO_KEY =
        "__CONTROLE_GLOBAL_TAMPERMONKEY__";


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

        if (verificando) {
            return;
        }

        verificando = true;


        console.log(
            "[CONTROLE GLOBAL] Verificando B1..."
        );


        GM_xmlhttpRequest({

            method: "GET",

            url: criarURL(),

            timeout: 10000,


            onload: function (resposta) {

                try {

                    if (
                        resposta.status < 200 ||
                        resposta.status >= 300
                    ) {

                        throw new Error(
                            "HTTP " +
                            resposta.status
                        );

                    }


                    const texto =
                        resposta.responseText;


                    // =================================================
                    // LOCALIZA JSON
                    // =================================================

                    const inicio =
                        texto.indexOf("{");

                    const fim =
                        texto.lastIndexOf("}");


                    if (
                        inicio === -1 ||
                        fim === -1
                    ) {

                        throw new Error(
                            "Resposta do Google inválida."
                        );

                    }


                    const dados =
                        JSON.parse(
                            texto.substring(
                                inicio,
                                fim + 1
                            )
                        );


                    // =================================================
                    // PRIMEIRA LINHA
                    // =================================================

                    const linha =
                        dados?.table?.rows?.[0];


                    if (!linha) {

                        throw new Error(
                            "Não foi possível encontrar B1."
                        );

                    }


                    // =================================================
                    // B1
                    // =================================================

                    const valorB1 =
                        linha.c?.[1]?.v ?? "";


                    const status =
                        String(valorB1)
                            .trim()
                            .toLowerCase();


                    // =================================================
                    // ATIVO
                    // =================================================

                    if (status === "ativo") {

                        ativo = true;

                        estadoConfirmado = true;


                        removerAviso();


                        console.log(
                            "%c[CONTROLE GLOBAL] 🟢 ATIVO",
                            "color: green; font-weight: bold;"
                        );

                    }


                    // =================================================
                    // INATIVO
                    // =================================================

                    else {

                        ativo = false;

                        estadoConfirmado = true;


                        mostrarAviso();


                        console.warn(
                            "[CONTROLE GLOBAL] 🔴 INATIVO"
                        );

                    }


                }

                catch (erro) {

                    tratarErro(erro);

                }


                finally {

                    verificando = false;

                }

            },


            onerror: function () {

                tratarErro(
                    new Error(
                        "Falha de conexão com o Google."
                    )
                );

            },


            ontimeout: function () {

                tratarErro(
                    new Error(
                        "Timeout ao consultar Google Sheets."
                    )
                );

            }

        });

    }


    // =========================================================
    // TRATAMENTO DE ERRO
    // =========================================================

    function tratarErro(erro) {

        console.warn(
            "[CONTROLE GLOBAL] ⚠️ Erro:",
            erro
        );


        if (
            !CONFIG.MANTER_ULTIMO_ESTADO_EM_ERRO
        ) {

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

        // Só um aviso por aba.
        if (
            sessionStorage.getItem(
                AVISO_KEY
            )
        ) {

            return;

        }


        sessionStorage.setItem(
            AVISO_KEY,
            "1"
        );


        alert(
            "Ops! Os DOM do site atualizaram e eu não consigo realizar as ações.\n\n" +
            "Desative este script no Tampermonkey para essa mensagem parar de aparecer."
        );

    }


    // =========================================================
    // REMOVER AVISO
    // =========================================================

    function removerAviso() {

        sessionStorage.removeItem(
            AVISO_KEY
        );

    }


    // =========================================================
    // VERIFICAR SE PODE EXECUTAR
    // =========================================================

    function podeExecutar() {

        return (
            estadoConfirmado === true &&
            ativo === true
        );

    }


    // =========================================================
    // API PÚBLICA
    // =========================================================

    window.ControleGlobal = {

        verificar,

        podeExecutar,

        get ativo() {

            return ativo;

        },

        get confirmado() {

            return estadoConfirmado;

        }

    };


    // =========================================================
    // PRIMEIRA VERIFICAÇÃO
    // =========================================================

    verificar();


    // =========================================================
    // VERIFICAÇÃO AUTOMÁTICA
    // =========================================================

    setInterval(
        verificar,
        CONFIG.INTERVALO
    );


})();

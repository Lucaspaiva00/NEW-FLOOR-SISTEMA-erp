document.addEventListener(
    "DOMContentLoaded",
    () => {

        const sidebar =
            document.querySelector(".sidebar");

        if (!sidebar) return;

        const button =
            document.createElement("button");

        button.className =
            "mobile-menu-btn";

        button.innerHTML = "☰";

        document.body.appendChild(button);

        const overlay =
            document.createElement("div");

        overlay.className =
            "mobile-overlay";

        document.body.appendChild(
            overlay
        );

        function abrirMenu() {

            sidebar.classList.add(
                "mobile-open"
            );

            overlay.classList.add(
                "active"
            );

        }

        function fecharMenu() {

            sidebar.classList.remove(
                "mobile-open"
            );

            overlay.classList.remove(
                "active"
            );

        }

        button.addEventListener(
            "click",
            abrirMenu
        );

        overlay.addEventListener(
            "click",
            fecharMenu
        );

        document
            .querySelectorAll(
                ".menu a"
            )
            .forEach(link => {

                link.addEventListener(
                    "click",
                    fecharMenu
                );

            });

    }
);
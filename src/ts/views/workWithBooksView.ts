
/**
 * Work with books view
 */
let workWithBooksView = {

    /**
     * Setup view
     */
    setup() {

        // Update books event
        $("#wwbooks-update").click((e) => {
            e.preventDefault();

            if (!$("#wwbooks-license").prop("checked")) {
                alert(translations.text("youMustAgree"));
                return;
            }

            // Get selected books:
            const selectedBooks = [];
            $("tbody input:checked").parent().parent().each((index, tr) => {
                const bookNumber = parseInt($(tr).attr("data-book-number"), 10);
                selectedBooks.push(bookNumber);
            });

            workWithBooksController.downloadBooks(selectedBooks);
        });

        // Select / deselect all books
        $("#wwbooks-all").change(() => {
            const $allChecks = $("tbody input");
            if ($(this).prop("checked")) {
                $allChecks.prop("checked", "checked");
            } else {
                $allChecks.removeAttr("checked");
            }
        });

        // Close / cancel button
        $("#wwbooks-closemodal").click((e) => {
            e.preventDefault();
            workWithBooksView.closeCancelClicked();
        });
    },

    closeCancelClicked() {
        if (workWithBooksController.changingBooks) {
            // Cancel process
            if (!confirm(translations.text("confirmCancel"))) {
                return;
            }
        }

        workWithBooksController.closeCancelClicked();
    },

    /**
     * Set the "select all" checked / unchecked
     * @param {bool} checked True to check. False to uncheck
     */
    setSelectAllState(checked: boolean) {
        if (checked) {
            $("#wwbooks-all").prop("checked", "checked");
        } else {
            $("#wwbooks-all").removeAttr("checked");
        }
    },

    updateBooksList(booksState: BookDownloadState[]) {
        const $tableBody = $("#wwbooks-list > tbody");
        $tableBody.empty();

        let html = "";
        for (const book of booksState) {
            html += '<tr data-book-number="' + book.bookNumber +
                '" style="width:100%"><td>' +
                book.bookNumber + ". " + book.getTitle() +
                '</td><td style="white-space: nowrap">' + book.size.toString() + " MB</td>" +
                '<td class="center"><input type="checkbox"></td>' +
                "</tr>";
        }

        $tableBody.append(html);
    },

    markBookAsDownloaded(bookNumber: number) {
        const $row = $("tr[data-book-number=" + bookNumber + "]");
        $row.addClass("success");
        $row.find("input").prop("checked", "checked");
    },

    displayModal(show: boolean) {
        if (show) {
            // Clear the log
            $("#wwbooks-log").empty();

            // Set cancel button
            $("#wwbooks-closemodal")
                .removeClass("btn-primary")
                .addClass("btn-danger")
                .text(translations.text("cancel"));

            // Do no close the dialog with the hardware back button
            $("#wwbooks-modal").addClass("nobackbutton");
        }

        $("#wwbooks-modal").modal(show ? "show" : "hide");
    },

    enableCloseModal() {
        // Set close button
        $("#wwbooks-closemodal")
            .removeClass("btn-danger")
            .addClass("btn-primary")
            .text(translations.text("close"));

        // Enable to close the dialog with the hardware back button
        $("#wwbooks-modal").removeClass("nobackbutton");
    },

    logEvent(msg: string) {
        $("#wwbooks-log").append(msg + "\n\n");
    },

    setCurrentWork(msg: string) {
        $("#wwbooks-current").text(msg);
        workWithBooksView.updateProgress(0);
    },

    updateProgress(percent: number) {
        $("#wwbooks-progress").css("width", percent + "%");
    },

};

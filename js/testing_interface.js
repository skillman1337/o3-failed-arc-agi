// Internal state.
var CURRENT_INPUT_GRID = new Grid(3, 3);
var CURRENT_OUTPUT_GRID = new Grid(3, 3);
var TEST_PAIRS = new Array();
var CURRENT_TEST_PAIR_INDEX = 0;
var COPY_PASTE_DATA = new Array();

// Cosmetic.
var EDITION_GRID_HEIGHT = 500;
var EDITION_GRID_WIDTH = 500;
var MAX_CELL_SIZE = 100;

// Data from results.json and attempts.json
var FAILED_TASKS = [];
var ATTEMPTS = {};
var CURRENT_FAILED_TASK_INDEX = 0;

function resetTask() {
    CURRENT_INPUT_GRID = new Grid(3, 3);
    TEST_PAIRS = new Array();
    CURRENT_TEST_PAIR_INDEX = 0;
    $('#task_preview').html('');
    resetOutputGrid();
}

function refreshEditionGrid(jqGrid, dataGrid) {
    fillJqGridWithData(jqGrid, dataGrid);
    setUpEditionGridListeners(jqGrid);
    fitCellsToContainer(jqGrid, dataGrid.height, dataGrid.width, EDITION_GRID_HEIGHT, EDITION_GRID_HEIGHT);
    initializeSelectable();
}

function syncFromEditionGridToDataGrid(jqGrid, dataGrid) {
    copyJqGridToDataGrid(jqGrid, dataGrid);
}

function syncFromDataGridToEditionGrid(jqGrid, dataGrid) {
    refreshEditionGrid(jqGrid, dataGrid);
}

function getSelectedSymbol() {
    selected = $('#symbol_picker .selected-symbol-preview')[0];
    return $(selected).attr('symbol');
}

function setUpEditionGridListeners(jqGrid) {
    jqGrid.find('.cell').click(function(event) {
        cell = $(event.target);
        symbol = getSelectedSymbol();

        mode = $('input[name=tool_switching]:checked').val();
        if (mode == 'floodfill') {
            // If floodfill: fill all connected cells.
            syncFromEditionGridToDataGrid(jqGrid, CURRENT_OUTPUT_GRID);
            grid = CURRENT_OUTPUT_GRID.grid;
            floodfillFromLocation(grid, cell.attr('x'), cell.attr('y'), symbol);
            syncFromDataGridToEditionGrid(jqGrid, CURRENT_OUTPUT_GRID);
        }
        else if (mode == 'edit') {
            // Else: fill just this cell.
            setCellSymbol(cell, symbol);
        }
    });
}

function resetOutputGrid() {
    $('#output_grid').empty(); // Clear any existing grids
    CURRENT_OUTPUT_GRID = new Grid(3, 3);
}

function copyFromInput() {
    syncFromEditionGridToDataGrid($('#output_grid .edition_grid'), CURRENT_OUTPUT_GRID);
    CURRENT_OUTPUT_GRID = convertSerializedGridToGridObject(CURRENT_INPUT_GRID.grid);
    syncFromDataGridToEditionGrid($('#output_grid .edition_grid'), CURRENT_OUTPUT_GRID);
}

function fillPairPreview(pairId, inputGrid, outputGrid) {
    var pairSlot = $('#pair_preview_' + pairId);
    if (!pairSlot.length) {
        // Create HTML for pair.
        pairSlot = $('<div id="pair_preview_' + pairId + '" class="pair_preview" index="' + pairId + '"></div>');
        pairSlot.appendTo('#task_preview');
    }
    var jqInputGrid = pairSlot.find('.input_preview');
    if (!jqInputGrid.length) {
        jqInputGrid = $('<div class="input_preview"></div>');
        jqInputGrid.appendTo(pairSlot);
    }
    var jqOutputGrid = pairSlot.find('.output_preview');
    if (!jqOutputGrid.length) {
        jqOutputGrid = $('<div class="output_preview"></div>');
        jqOutputGrid.appendTo(pairSlot);
    }

    fillJqGridWithData(jqInputGrid, inputGrid);
    fitCellsToContainer(jqInputGrid, inputGrid.height, inputGrid.width, 200, 200);
    fillJqGridWithData(jqOutputGrid, outputGrid);
    fitCellsToContainer(jqOutputGrid, outputGrid.height, outputGrid.width, 200, 200);
}

function loadJSONTask(train, test) {
    resetTask();
    hideElements(['#modal_bg', '#error_display', '#info_display']);

    populateTrainingPairs(train);
    populateTestPairs(test);

    if (test.length > 0) {
        displayTestOutput(0, '#solution_output1', '#input_grid_size1', CURRENT_INPUT_GRID);
    }

    if (test.length > 1) {
        displayTestOutput(1, '#solution_output2', '#input_grid_size2', getNextInputGrid(1));
        showElements([
            '#eval_text_2',
            '#sol_text_2',
            '#evaluation_input2',
            '#solution_output2'
        ]);
    }

    if (test.length === 1) {
        hideElements([
            '#evaluation_input2',
            '#solution_output2',
            '#eval_text_2',
            '#sol_text_2'
        ]);
    }

    console.log(test);
}

function hideElements(selectors) {
    selectors.forEach(selector => $(selector).hide());
}

function showElements(selectors) {
    selectors.forEach(selector => $(selector).show());
}

function populateTrainingPairs(train) {
    train.forEach((pair, index) => {
        const inputGrid = convertSerializedGridToGridObject(pair.input);
        const outputGrid = convertSerializedGridToGridObject(pair.output);
        fillPairPreview(index, inputGrid, outputGrid);
    });
}

function populateTestPairs(test) {
    TEST_PAIRS.length = 0; // Clear existing test pairs
    test.forEach(pair => TEST_PAIRS.push(pair));

    if (TEST_PAIRS.length > 0) {
        const firstInput = convertSerializedGridToGridObject(TEST_PAIRS[0].input);
        CURRENT_INPUT_GRID = firstInput;
        fillTestInput(CURRENT_INPUT_GRID);
        CURRENT_TEST_PAIR_INDEX = 0;
        updateTestCounters(1, test.length);
    }
}

function updateTestCounters(current, total) {
    $('#current_test_input_id_display').text(current);
    $('#total_test_input_count_display').text(total);
}

function displayTestOutput(index, outputSelector, sizeSelector, inputGrid) {
    const testPair = TEST_PAIRS[index];
    if (!testPair) return;

    const outputGrid = convertSerializedGridToGridObject(testPair.output);
    fillJqGridWithData($(outputSelector), outputGrid);
    fitCellsToContainer($(outputSelector), outputGrid.height, outputGrid.width, 400, 400);
    $(sizeSelector).text(`${outputGrid.height}x${outputGrid.width}`);

    if (index === 0) {
        $('#solution_grid_size1').text(`${inputGrid.height}x${inputGrid.width}`);
    } else if (index === 1) {
        $('#solution_grid_size2').text(`${inputGrid.height}x${inputGrid.width}`);
    }
}

function getNextInputGrid(index) {
    if (TEST_PAIRS[index]) {
        const nextInput = convertSerializedGridToGridObject(TEST_PAIRS[index].input);
        CURRENT_INPUT_GRID = nextInput;
        fillJqGridWithData($('#evaluation_input2'), CURRENT_INPUT_GRID);
        fitCellsToContainer($('#evaluation_input2'), CURRENT_INPUT_GRID.height, CURRENT_INPUT_GRID.width, 400, 400);
        $('#input_grid_size2').text(`${CURRENT_INPUT_GRID.height}x${CURRENT_INPUT_GRID.width}`);
        return CURRENT_INPUT_GRID;
    }
    return null;
}

function display_task_name(task_name, current, total) {
    big_space = ' '.repeat(4); 
    document.getElementById('task_name').innerHTML = (
        'Failed task name:' + big_space + task_name + ` (${current} / ${total})`
    );
}

function loadResultsAndAttempts() {
    $.getJSON("results.json", function(results) {
        FAILED_TASKS = [];
        for (var task_name in results.task_results) {
            if (results.task_results[task_name] == 0.0) {
                FAILED_TASKS.push(task_name);
            }
        }

        $.getJSON("attempts.json", function(attempts_data) {
            ATTEMPTS = attempts_data;
            CURRENT_FAILED_TASK_INDEX = 0;
            loadFailedTask();
        })
        .error(function(){
          errorMsg('Error loading attempts.json');
        });
    })
    .error(function(){
      errorMsg('Error loading results.json');
    });
}

function loadFailedTask() {
    if (FAILED_TASKS.length === 0) {
        errorMsg('No failed tasks found.');
        return;
    }

    const task_name = FAILED_TASKS[CURRENT_FAILED_TASK_INDEX];
    if (!(task_name in ATTEMPTS)) {
        errorMsg('Attempts for task ' + task_name + ' not found in attempts.json');
        return;
    }

    resetTask();
    $('#modal_bg').hide();
    $('#error_display').hide();
    $('#info_display').hide();

    // Load the task from the ARC dataset using the task name
    const subset = "evaluation"; // Adjust if necessary (e.g., "training")
    $.getJSON("contents/data/" + subset + "/" + task_name + ".json", function(task) {
        const train = task['train'];
        const test = task['test'];
        loadJSONTask(train, test);
        display_task_name(task_name, CURRENT_FAILED_TASK_INDEX + 1, FAILED_TASKS.length);

        // Clear the output grid before displaying attempts
        $('#output_grid').empty();

        const attemptsArray = ATTEMPTS[task_name];

        if (Array.isArray(attemptsArray)) {
            // Iterate through each attempt object in the array
            for (let i = 0; i < attemptsArray.length; i++) {
                const attemptEntry = attemptsArray[i];
                
                // Iterate through each attempt key within the attempt object
                for (const attempt_key in attemptEntry) {
                    if (attemptEntry.hasOwnProperty(attempt_key)) {
                        const attempt = attemptEntry[attempt_key];
                        const attemptGrid = convertSerializedGridToGridObject(attempt);

                        // Create and append the title for the attempt
                        const title = $('<h3 style="clear:both;padding-top: 25px;">').text(`o3 ${attempt_key} (${attemptGrid.height}x${attemptGrid.width})`);
                        
                        // Create the grid container
                        const jqGrid = $('<div>').addClass('edition_grid selectable_grid');
                        if (i > 0 || Object.keys(attemptEntry).length > 1) {
                            jqGrid.css('margin-top', '25px');
                        }

                        // Append the title and grid to the output container
                        $('#output_grid').append(title, jqGrid);

                        // Populate the grid with the attempt data
                        syncFromDataGridToEditionGrid(jqGrid, attemptGrid);
                    }
                }
            }
        } else {
            errorMsg('Unexpected format for attempts data.');
        }
    })
    .fail(function(){
        errorMsg('Error loading task from ARC dataset');
    });
}

function nextFailedTask() {
    if (CURRENT_FAILED_TASK_INDEX < FAILED_TASKS.length - 1) {
        CURRENT_FAILED_TASK_INDEX++;
        loadFailedTask();
    } else {
        errorMsg('No more failed tasks.');
    }
}

function previousFailedTask() {
    if (CURRENT_FAILED_TASK_INDEX > 0) {
        CURRENT_FAILED_TASK_INDEX--;
        loadFailedTask();
    } else {
        errorMsg('Already at the first failed task.');
    }
}

function nextTestInput() {
    if (TEST_PAIRS.length <= CURRENT_TEST_PAIR_INDEX + 1) {
        errorMsg('No next test input. Pick another file?')
        return
    }
    CURRENT_TEST_PAIR_INDEX += 1;
    values = TEST_PAIRS[CURRENT_TEST_PAIR_INDEX]['input'];
    CURRENT_INPUT_GRID = convertSerializedGridToGridObject(values)
    fillTestInput(CURRENT_INPUT_GRID);
    $('#current_test_input_id_display').html(CURRENT_TEST_PAIR_INDEX + 1);
    $('#total_test_input_count_display').html(TEST_PAIRS.length);
}

function submitSolution() {
    syncFromEditionGridToDataGrid($('#output_grid .edition_grid'), CURRENT_OUTPUT_GRID);
    reference_output = TEST_PAIRS[CURRENT_TEST_PAIR_INDEX]['output'];
    submitted_output = CURRENT_OUTPUT_GRID.grid;
    if (reference_output.length != submitted_output.length) {
        errorMsg('Wrong solution.');
        return
    }
    for (var i = 0; i < reference_output.length; i++){
        ref_row = reference_output[i];
        for (var j = 0; j < ref_row.length; j++){
            if (ref_row[j] != submitted_output[i][j]) {
                errorMsg('Wrong solution.');
                return
            }
        }

    }
    infoMsg('Correct solution!');
}

function fillTestInput(inputGrid) {
    jqInputGrid = $('#evaluation_input1');
    fillJqGridWithData(jqInputGrid, inputGrid);
    fitCellsToContainer(jqInputGrid, inputGrid.height, inputGrid.width, 400, 400);
    $('#input_grid_size').text(`${inputGrid.height}x${inputGrid.width}`);
}

function initializeSelectable() {
    try {
        $('.selectable_grid').selectable('destroy');
    }
    catch (e) {
    }
    toolMode = $('input[name=tool_switching]:checked').val();
    if (toolMode == 'select') {
        infoMsg('Select some cells and click on a color to fill in, or press C to copy');
        $('.selectable_grid').selectable(
            {
                autoRefresh: false,
                filter: '> .row > .cell',
                start: function(event, ui) {
                    $('.ui-selected').each(function(i, e) {
                        $(e).removeClass('ui-selected');
                    });
                }
            }
        );
    }
}

// Initial event binding.

$(document).ready(function () {
    $('#symbol_picker').find('.symbol_preview').click(function(event) {
        symbol_preview = $(event.target);
        $('#symbol_picker').find('.symbol_preview').each(function(i, preview) {
            $(preview).removeClass('selected-symbol-preview');
        })
        symbol_preview.addClass('selected-symbol-preview');

        toolMode = $('input[name=tool_switching]:checked').val();
        if (toolMode == 'select') {
            $('.edition_grid').find('.ui-selected').each(function(i, cell) {
                symbol = getSelectedSymbol();
                setCellSymbol($(cell), symbol);
            });
        }
    });

    $('input[type=radio][name=tool_switching]').change(function() {
        initializeSelectable();
    });

    $('body').keydown(function(event) {
        // Copy and paste functionality.
        if (event.which == 67) {
            // Press C

            selected = $('.ui-selected');
            if (selected.length == 0) {
                return;
            }

            COPY_PASTE_DATA = [];
            for (var i = 0; i < selected.length; i ++) {
                x = parseInt($(selected[i]).attr('x'));
                y = parseInt($(selected[i]).attr('y'));
                symbol = parseInt($(selected[i]).attr('symbol'));
                COPY_PASTE_DATA.push([x, y, symbol]);
            }
            infoMsg('Cells copied! Select a target cell and press V to paste at location.');

        }
        if (event.which == 86) {
            // Press P
            if (COPY_PASTE_DATA.length == 0) {
                errorMsg('No data to paste.');
                return;
            }
            selected = $('.edition_grid').find('.ui-selected');
            if (selected.length == 0) {
                errorMsg('Select a target cell on the output grid.');
                return;
            }

            jqGrid = $(selected.parent().parent()[0]);

            if (selected.length == 1) {
                targetx = parseInt(selected.attr('x'));
                targety = parseInt(selected.attr('y'));

                xs = new Array();
                ys = new Array();
                symbols = new Array();

                for (var i = 0; i < COPY_PASTE_DATA.length; i ++) {
                    xs.push(COPY_PASTE_DATA[i][0]);
                    ys.push(COPY_PASTE_DATA[i][1]);
                    symbols.push(COPY_PASTE_DATA[i][2]);
                }

                minx = Math.min(...xs);
                miny = Math.min(...ys);
                for (var i = 0; i < xs.length; i ++) {
                    x = xs[i];
                    y = ys[i];
                    symbol = symbols[i];
                    newx = x - minx + targetx;
                    newy = y - miny + targety;
                    res = jqGrid.find('[x="' + newx + '"][y="' + newy + '"] ');
                    if (res.length == 1) {
                        cell = $(res[0]);
                        setCellSymbol(cell, symbol);
                    }
                }
            } else {
                errorMsg('Can only paste at a specific location; only select *one* cell as paste destination.');
            }
        }
    });
});

loadResultsAndAttempts()
// Получаем элементы
const dateButton = document.getElementById('dateButton');
const datePicker = document.getElementById('datePicker');

// Инициализация flatpickr
const fp = flatpickr(datePicker, {
    locale: "ru",
    minDate: "today",
    dateFormat: "d.m.Y",
    appendTo: document.querySelector('.date-wrapper'),
    position: "below",
    onChange: function(selectedDates, dateStr) {
        if (dateStr) {
            dateButton.textContent = dateStr;
            dateButton.style.backgroundColor = '#e0e0e0';
            dateButton.style.color = '#666';
            dateButton.style.borderColor = '#ccc';
            console.log('Выбранная дата:', dateStr);
        }
    }
});

// При клике на кнопку открываем календарь
dateButton.addEventListener('click', function(e) {
    e.preventDefault();
    fp.open();
});
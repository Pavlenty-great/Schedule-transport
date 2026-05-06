// Получаем элементы
const dateButton = document.getElementById('dateButton');
const datePicker = document.getElementById('datePicker');
const dateDisplay = document.querySelector('.info-header .date');

// Функция для форматирования даты в дд.мм.гггг
function formatDateForInput(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Функция форматирования даты в нужный вид (с днём недели)
function formatDateWithWeekday(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const weekdays = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const weekday = weekdays[date.getDay()];
    return `${day}.${month}.${year}, ${weekday}`;
}

// Функция для форматирования даты для отображения в кнопке
function formatDateForDisplay(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date.toDateString() === today.toDateString()) {
        return "Сегодня";
    }
    return formatDateForInput(date);
}

// Функция обновления отображаемой даты в info-header
function updateDisplayDate(date) {
    if (dateDisplay) {
        dateDisplay.textContent = `Дата: ${formatDateWithWeekday(date)}`;
    }
}

// Устанавливаем дату из скрытого поля, если оно есть (после поиска)
let currentDate = null;
if (datePicker.value) {
    const parts = datePicker.value.split('.');
    if (parts.length === 3) {
        currentDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        currentDate.setHours(0, 0, 0, 0);
        dateButton.textContent = formatDateForDisplay(currentDate);
        dateButton.style.backgroundColor = '#e0e0e0';
        dateButton.style.color = '#666';
        dateButton.style.borderColor = '#ccc';
        dateButton.classList.add('has-date');
        updateDisplayDate(currentDate);
    }
}

// Если нет сохраненной даты, устанавливаем сегодня
if (!currentDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    currentDate = today;
    datePicker.value = formatDateForInput(today);
    dateButton.textContent = "Сегодня";
    updateDisplayDate(today);
}

// Инициализация flatpickr (только один раз!)
const fp = flatpickr(datePicker, {
    locale: "ru",
    minDate: "today",
    dateFormat: "d.m.Y",
    appendTo: document.querySelector('.date-wrapper'),
    position: "below",
    defaultDate: currentDate,
    onChange: function(selectedDates, dateStr) {
        if (selectedDates.length > 0) {
            const selectedDate = selectedDates[0];
            
            // Сохраняем дату в скрытое поле
            datePicker.value = dateStr;
            
            // Обновляем текст кнопки
            dateButton.textContent = formatDateForDisplay(selectedDate);
            dateButton.style.backgroundColor = '#e0e0e0';
            dateButton.style.color = '#666';
            dateButton.style.borderColor = '#ccc';
            dateButton.classList.add('has-date');
            
            // Обновляем отображение даты на странице
            updateDisplayDate(selectedDate);
            
            console.log('Выбранная дата:', dateStr);
        }
    }
});

// При клике на кнопку открываем календарь
dateButton.addEventListener('click', function(e) {
    e.preventDefault();
    fp.open();
});
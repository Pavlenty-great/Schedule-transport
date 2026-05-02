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

// datepicker.js
// Инициализация календаря для выбора даты

document.addEventListener('DOMContentLoaded', function() {
    // Получаем элементы
    const dateButton = document.getElementById('dateButton');
    const datePicker = document.getElementById('datePicker');
    const dateDisplay = document.querySelector('.info-header .date'); // Элемент для отображения даты
    
    // Если элементов нет на странице, выходим
    if (!dateButton || !datePicker) return;
    
    // Функция форматирования даты в нужный вид
    function formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        // Получаем день недели на русском
        const weekdays = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
        const weekday = weekdays[date.getDay()];
        
        return `${day}.${month}.${year}, ${weekday}`;
    }
    
    // Функция обновления отображаемой даты
    function updateDisplayDate(date) {
        if (dateDisplay) {
            dateDisplay.textContent = `Дата: ${formatDate(date)}`;
        }
    }
    
    // Получаем текущую дату
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Устанавливаем текущую дату в отображение
    updateDisplayDate(today);
    
    // Инициализация flatpickr
    const fp = flatpickr(datePicker, {
        locale: "ru",
        minDate: "today",
        dateFormat: "d.m.Y",
        appendTo: document.querySelector('.date-wrapper'),
        position: "below",
        defaultDate: today, // Устанавливаем текущую дату по умолчанию
        onChange: function(selectedDates, dateStr) {
            if (selectedDates.length > 0) {
                const selectedDate = selectedDates[0];
                
                // Обновляем текст кнопки
                if (formatDate(selectedDate) === formatDate(today)) {
                    dateButton.textContent = "Сегодня";
                } else {
                    dateButton.textContent = dateStr;
                }
                
                // Делаем кнопку тусклой
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
    
    // Устанавливаем текст кнопки по умолчанию
    dateButton.textContent = "Сегодня";
    
    // При клике на кнопку открываем календарь
    dateButton.addEventListener('click', function(e) {
        e.preventDefault();
        fp.open();
    });
});
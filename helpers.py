from datetime import datetime


def get_weekday_id(date_str):
    """Преобразует дату из формата дд.мм.гггг в id дня недели (1-7)"""
    try:
        return datetime.strptime(date_str, '%d.%m.%Y').weekday() + 1
    except:
        return None


def format_display_date(date_str):
    """Форматирует дату для отображения с днём недели"""
    if not date_str:
        return ''
    try:
        date_obj = datetime.strptime(date_str, '%d.%m.%Y')
        weekdays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
        return f"{date_str}, {weekdays[date_obj.weekday()]}"
    except:
        return date_str


def get_transport_type_id(type_name):
    """Возвращает id типа транспорта по названию"""
    type_mapping = {
        'Автобус': 1,
        'Поезд': 2,
        'Электричка': 3
    }
    return type_mapping.get(type_name, 1)
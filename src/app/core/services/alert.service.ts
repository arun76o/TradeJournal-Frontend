import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  success(title: string, text?: string) {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonColor: '#16a34a'
    });
  }

  error(title: string, text?: string) {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonColor: '#dc2626'
    });
  }

  warning(title: string, text?: string) {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonColor: '#f59e0b'
    });
  }

  info(title: string, text?: string) {
    return Swal.fire({
      icon: 'info',
      title,
      text
    });
  }

  confirm(title: string, text?: string) {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes',
      cancelButtonText: 'Cancel'
    });
  }
}
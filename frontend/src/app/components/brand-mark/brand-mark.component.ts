import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BRAND_NAME, BRAND_TAGLINE } from '../../core/brand';

export type BrandMarkSize = 'xs' | 'sm' | 'md' | 'lg';
export type BrandMarkVariant = 'full' | 'icon';

@Component({
  selector: 'app-brand-mark',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './brand-mark.component.html',
  styleUrl: './brand-mark.component.scss'
})
export class BrandMarkComponent {
  @Input() size: BrandMarkSize = 'md';
  @Input() variant: BrandMarkVariant = 'full';
  @Input() showTagline = false;
  @Input() nameClass = '';
  @Input() taglineClass = 'muted';

  readonly brandName = BRAND_NAME;
  readonly brandTagline = BRAND_TAGLINE;
}
